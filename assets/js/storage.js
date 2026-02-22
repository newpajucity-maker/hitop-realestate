// assets/js/storage.js
// ── Supabase REST 어댑터 ──────────────────────────────────────────────
// ※ 아래 두 값을 Supabase 대시보드 → Settings → API 에서 복사해 붙여넣으세요.

const SUPABASE_URL = "https://YOUR_PROJECT_ID.supabase.co"; // ← 여기 수정
const SUPABASE_KEY = "YOUR_ANON_PUBLIC_KEY";                // ← 여기 수정

(function () {
  "use strict";

  const Storage = {};

  // ── 테이블 매핑 ────────────────────────────────────────────────────
  // localStorage 키 → Supabase 테이블명
  const TABLE = {
    listings:       "listings",
    buildings:      "buildings",
    customers:      "customers",
    scheduleEvents: "schedule_events",
  };

  // ── 행 변환: JS 객체 → DB row ──────────────────────────────────────
  // 자주 검색하는 필드는 컬럼으로 분리, 나머지는 data(jsonb)에 보관
  function toRow(table, item) {
    const base = { id: item.id, data: item };
    if (table === "listings") {
      base.type          = item.type          || null;
      base.deal_type     = item.dealType      || null;
      base.status        = item.status        || null;
      base.is_listed     = item.isListed      ?? true;
      base.building_id   = item.buildingId    || null;
      base.building_name = item.buildingName  || null;
      base.address       = item.address       || null;
      base.owner_name    = item.ownerName     || null;
      base.tenant_name   = item.tenantName    || null;
      base.created_at    = item.createdAt     || new Date().toISOString();
      base.updated_at    = item.updatedAt     || new Date().toISOString();
    }
    if (table === "buildings") {
      base.type       = item.type    || null;
      base.name       = item.name    || null;
      base.address    = item.address || null;
      base.created_at = item.createdAt || new Date().toISOString();
      base.updated_at = item.updatedAt || new Date().toISOString();
    }
    if (table === "customers") {
      base.name       = item.name  || null;
      base.phone      = item.phone || null;
      base.created_at = item.createdAt || new Date().toISOString();
      base.updated_at = item.updatedAt || new Date().toISOString();
    }
    if (table === "schedule_events") {
      base.date       = item.date  || null;
      base.title      = item.title || null;
      base.created_at = item.createdAt || new Date().toISOString();
    }
    return base;
  }

  // ── 행 변환: DB row → JS 객체 ──────────────────────────────────────
  function fromRow(row) {
    return row.data || row;
  }

  // ── 공통 Supabase REST 호출 ────────────────────────────────────────
  async function sbFetch(path, options = {}) {
    const url = SUPABASE_URL + "/rest/v1/" + path;
    const headers = {
      "apikey":        SUPABASE_KEY,
      "Authorization": "Bearer " + SUPABASE_KEY,
      "Content-Type":  "application/json",
    };
    if (options.prefer) headers["Prefer"] = options.prefer;

    const res = await fetch(url, {
      method:  options.method  || "GET",
      headers,
      body:    options.body    || undefined,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error("[Supabase] " + res.status + " " + errText);
    }

    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  // ── getArray: 테이블 전체 읽기 ────────────────────────────────────
  Storage.getArray = async function (key) {
    const table = TABLE[key];
    if (!table) {
      return Storage.safeJsonParse(localStorage.getItem(key), []);
    }
    try {
      const rows = await sbFetch(
        table + "?select=data&order=created_at.asc&limit=10000"
      );
      const result = (rows || []).map(fromRow).filter(x => x && typeof x === "object");
      // 오프라인 폴백용 로컬 캐시 갱신
      localStorage.setItem("sb_cache_" + key, JSON.stringify(result));
      return result;
    } catch (e) {
      console.error("[Storage] getArray 실패 (" + key + "):", e);
      // 오프라인 · 일시 오류 시 캐시로 폴백
      return Storage.safeJsonParse(localStorage.getItem("sb_cache_" + key), []);
    }
  };

  // ── setArray: 배열 전체 교체 ──────────────────────────────────────
  Storage.setArray = async function (key, arr) {
    const table = TABLE[key];
    if (!table) {
      localStorage.setItem(key, JSON.stringify(arr));
      return;
    }
    try {
      // 1. 기존 전체 삭제
      await sbFetch(table + "?id=neq.__PLACEHOLDER__", {
        method: "DELETE",
        prefer: "return=minimal",
      });
      // 2. 새 데이터 배치 upsert (100건씩)
      const BATCH = 100;
      for (let i = 0; i < arr.length; i += BATCH) {
        const chunk = arr.slice(i, i + BATCH).map(item => toRow(table, item));
        await sbFetch(table, {
          method: "POST",
          prefer: "resolution=merge-duplicates,return=minimal",
          body:   JSON.stringify(chunk),
        });
      }
      // 캐시 갱신
      localStorage.setItem("sb_cache_" + key, JSON.stringify(arr));
    } catch (e) {
      console.error("[Storage] setArray 실패 (" + key + "):", e);
      alert(
        "데이터 저장에 실패했습니다.\n" +
        "인터넷 연결을 확인하거나 잠시 후 다시 시도해주세요.\n" +
        "(" + e.message + ")"
      );
      throw e;
    }
  };

  // ── upsertOne: 단건 저장 (매물 1건 저장 시 전체 교체보다 효율적) ──
  Storage.upsertOne = async function (key, item) {
    const table = TABLE[key];
    if (!table) {
      const arr = Storage.safeJsonParse(localStorage.getItem(key), []);
      const idx = arr.findIndex(x => x.id === item.id);
      if (idx >= 0) arr[idx] = item; else arr.unshift(item);
      localStorage.setItem(key, JSON.stringify(arr));
      return;
    }
    try {
      const row = toRow(table, item);
      await sbFetch(table, {
        method: "POST",
        prefer: "resolution=merge-duplicates,return=minimal",
        body:   JSON.stringify(row),
      });
      // 캐시 단건 갱신
      const cached = Storage.safeJsonParse(
        localStorage.getItem("sb_cache_" + key), []
      );
      const idx = cached.findIndex(x => x.id === item.id);
      if (idx >= 0) cached[idx] = item; else cached.unshift(item);
      localStorage.setItem("sb_cache_" + key, JSON.stringify(cached));
    } catch (e) {
      console.error("[Storage] upsertOne 실패 (" + key + "):", e);
      throw e;
    }
  };

  // ── deleteOne: 단건 삭제 ──────────────────────────────────────────
  Storage.deleteOne = async function (key, id) {
    const table = TABLE[key];
    if (!table) {
      const arr = Storage.safeJsonParse(localStorage.getItem(key), [])
        .filter(x => x.id !== id);
      localStorage.setItem(key, JSON.stringify(arr));
      return;
    }
    try {
      await sbFetch(table + "?id=eq." + encodeURIComponent(id), {
        method: "DELETE",
        prefer: "return=minimal",
      });
      // 캐시에서도 제거
      const cached = Storage.safeJsonParse(
        localStorage.getItem("sb_cache_" + key), []
      ).filter(x => x.id !== id);
      localStorage.setItem("sb_cache_" + key, JSON.stringify(cached));
    } catch (e) {
      console.error("[Storage] deleteOne 실패 (" + key + "):", e);
      throw e;
    }
  };

  // ── 유틸 ──────────────────────────────────────────────────────────
  Storage.safeJsonParse = function (s, fallback) {
    try { return JSON.parse(s); } catch { return fallback; }
  };

  Storage.uid = function (prefix = "id") {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  };

  Storage.downloadJson = function (filename, obj) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 클라우드 전환 후 로컬 마이그레이션 불필요 → 빈 함수 유지 (호환성)
  Storage.migrateAll = function () {};

  window.StorageUtil = Storage;
})();
