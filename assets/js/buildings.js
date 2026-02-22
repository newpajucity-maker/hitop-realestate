// assets/js/buildings.js
(function () {
  "use strict";

  const LS_KEY = "buildings";
  // 기존 고정층 입력 방식 → 필요한 층만 추가하는 방식으로 변경
  const FLOOR_PRESETS = ["B3","B2","B1","1F","2F","3F","4F","5F","6F","7F","8F","9F","10F","11F","12F","13F","14F","15F"];

  // [N-3 수정] URL 안전성 검증 함수 추가
  function safeUrl(u) {
    if (!u || typeof u !== "string") return "";
    try {
      const url = new URL(u.trim());
      return (url.protocol === "https:" || url.protocol === "http:") ? u.trim() : "";
    } catch { return ""; }
  }

  let currentType = "shop";
  let currentFilter = "all";
  let editId = null;

  const $ = (id) => document.getElementById(id);

  const elTabs = $("typeTabs");
  const elTypeExtra = $("typeExtra");
  const elFormTitle = $("formTitle");

  const elName = $("b_name");
  const elAddr = $("b_address");
  const elApproved = $("b_approved");
  const elScaleB = $("b_scale_b");
  const elScaleG = $("b_scale_g");
  const elParking = $("b_parking");

  const elList = $("buildingList");
  const elEmpty = $("empty");
  const elSearch = $("searchInput");
  const elToast = $("toast");

  function toast(msg) {
    elToast.textContent = msg;
    elToast.classList.add("show");
    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(() => {
      elToast.classList.remove("show");
    }, 1600);
  }

  function getBuildings() { return StorageUtil.getArray(LS_KEY); }
  function setBuildings(arr) { StorageUtil.setArray(LS_KEY, arr); }

  function typeLabel(t) {
    if (t === "shop") return "상가";
    if (t === "officetel") return "오피스텔";
    if (t === "apartment") return "아파트";
    if (t === "bizcenter") return "지산";
    return "기타";
  }

  function normalizeName(s) { return (s || "").trim().replace(/\s+/g, " "); }

  function renderTypeExtra(type, data = null) {
    elTypeExtra.innerHTML = "";

    if (type === "shop") {
      elFormTitle.textContent = editId ? "상가 건물 수정" : "상가 건물 등록";
      const wrap = document.createElement("div");
      wrap.innerHTML = `
        <div class="row">
          <div class="field"><label>상권요약(한 줄)</label><input id="shop_summary" placeholder="예: 운정역 역세권 / 학원가" /></div>
          <div class="field"><label>관리사무소 연락처</label><input id="shop_office" /></div>
        </div>
        <div class="field"><label>건물 특징(메모)</label><textarea id="shop_note"></textarea></div>
        <div class="field">
          <label>층별 평면도 URL</label>
          <div class="small" style="margin:-4px 0 10px;">필요한 층만 추가해서 URL을 저장하세요.</div>
          <div id="fpList" class="attach-list"></div>
          <button class="btn" type="button" id="btnAddFloorplan">+ 층 추가</button>
        </div>
      `;
      elTypeExtra.appendChild(wrap);

      const fpList = document.getElementById("fpList");
      const btnAdd = document.getElementById("btnAddFloorplan");

      const existing = normalizeFloorplans(data);
      if (existing.length) existing.forEach(e => addFloorplanRow(fpList, e.floor, e.url));
      else addFloorplanRow(fpList, "1F", "");

      btnAdd.onclick = () => addFloorplanRow(fpList, "", "");

      if (data) {
        $("shop_summary").value = data.shop_summary || "";
        $("shop_office").value = data.shop_office || "";
        $("shop_note").value = data.shop_note || "";
      }
    }

    if (type === "officetel") {
      elFormTitle.textContent = editId ? "오피스텔 건물 수정" : "오피스텔 건물 등록";
      const wrap = document.createElement("div");
      wrap.innerHTML = `
        <div class="field">
          <label>호수 배치도 URL (최대 3개)</label>
          <input id="lay1" placeholder="배치도 URL 1" />
          <input id="lay2" placeholder="배치도 URL 2" />
          <input id="lay3" placeholder="배치도 URL 3" />
        </div>
      `;
      elTypeExtra.appendChild(wrap);
      if (data) {
        const lays = data.layouts || [];
        $("lay1").value = lays[0] || "";
        $("lay2").value = lays[1] || "";
        $("lay3").value = lays[2] || "";
      }
    }
  }

  function saveBuilding() {
    const name = normalizeName(elName.value);
    if (!name) { toast("건물명은 필수입니다."); return; }

    const scaleB = toInt(elScaleB?.value);
    const scaleG = toInt(elScaleG?.value);
    const scaleText = makeScaleText(scaleB, scaleG);

    const base = {
      id: editId || StorageUtil.uid("b"),
      type: currentType, name,
      address: elAddr.value.trim(),
      approved: elApproved.value,
      scaleB, scaleG,
      scale: scaleText, // 호환용 표시 텍스트
      parking: elParking.value.trim(),
      updatedAt: new Date().toISOString(),
    };

    let extra = {};
    if (currentType === "shop") {
      const fpList = document.getElementById("fpList");
      const floorplansArr = collectFloorplans(fpList);
      const floorplans = {};
      // [N-3 수정] safeUrl로 검증 후 저장
      floorplansArr.forEach(e => {
        const cleanUrl = safeUrl(e.url);
        if (e.floor && cleanUrl) floorplans[e.floor] = cleanUrl;
      });
      extra = {
        shop_summary: $("shop_summary").value.trim(),
        shop_office: $("shop_office").value.trim(),
        shop_note: $("shop_note").value.trim(),
        floorplans,
        floorplansArr
      };
    }
    if (currentType === "officetel") {
      extra = { layouts: [$("lay1").value.trim(), $("lay2").value.trim(), $("lay3").value.trim()].filter(Boolean) };
    }

    const record = { ...base, ...extra };
    const arr = getBuildings();
    let next;
    if (editId) { next = arr.map((x) => (x.id === editId ? record : x)); toast("수정 완료"); }
    else { record.createdAt = new Date().toISOString(); next = [record, ...arr]; toast("등록 완료"); }

    setBuildings(next);
    renderList();
    clearForm();
  }

  function clearForm() {
    editId = null;
    elName.value = ""; elAddr.value = ""; elApproved.value = "";
    if (elScaleB) elScaleB.value = "";
    if (elScaleG) elScaleG.value = "";
    elParking.value = "";
    renderTypeExtra(currentType, null);
  }

  function loadToForm(id) {
    const arr = getBuildings();
    const item = arr.find((x) => x.id === id);
    if (!item) return;
    editId = item.id;
    currentType = item.type;
    Array.from(elTabs.querySelectorAll(".tab")).forEach((b) => b.classList.toggle("active", b.dataset.type === currentType));
    elName.value = item.name || ""; elAddr.value = item.address || "";
    elApproved.value = item.approved || "";
    const parsed = parseScale(item);
    if (elScaleB) elScaleB.value = parsed.scaleB ?? "";
    if (elScaleG) elScaleG.value = parsed.scaleG ?? "";
    elParking.value = item.parking || "";
    renderTypeExtra(currentType, item);
  }

  function addFloorplanRow(wrap, floor, url) {
    const row = document.createElement("div");
    row.className = "attach-item";
    const presetOptions = FLOOR_PRESETS.map(f => `<option value="${f}">${f}</option>`).join("");
    row.innerHTML = `
      <input class="fp-floor" list="floorPresets" placeholder="층(예: 1F, B1)" value="${escAttr(floor)}"/>
      <input class="fp-url" placeholder="URL" value="${escAttr(url)}"/>
      <button class="btn danger" type="button">삭제</button>
    `;
    row.querySelector("button").onclick = () => row.remove();
    wrap.appendChild(row);

    // datalist는 최초 1회만 주입
    if (!document.getElementById("floorPresets")) {
      const dl = document.createElement("datalist");
      dl.id = "floorPresets";
      dl.innerHTML = presetOptions;
      document.body.appendChild(dl);
    }
  }

  function collectFloorplans(wrap) {
    const arr = [];
    if (!wrap) return arr;
    wrap.querySelectorAll(".attach-item").forEach((row) => {
      const floor = (row.querySelector(".fp-floor")?.value || "").trim();
      const url = (row.querySelector(".fp-url")?.value || "").trim();
      if (floor || url) arr.push({ floor, url });
    });
    return arr.filter(e => e.floor && e.url);
  }

  function normalizeFloorplans(data) {
    if (!data) return [];
    if (Array.isArray(data.floorplansArr) && data.floorplansArr.length) {
      return data.floorplansArr
        .map(e => ({ floor: (e.floor||"").trim(), url: (e.url||"").trim() }))
        .filter(e => e.floor && e.url);
    }
    const obj = data.floorplans || {};
    return Object.keys(obj)
      .map(k => ({ floor: k, url: String(obj[k]||"").trim() }))
      .filter(e => e.floor && e.url);
  }

  function toInt(v) {
    const n = Number(String(v ?? "").trim());
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  }

  function makeScaleText(b, g) {
    const bb = Number(b) ? `지하${b}층` : "지하0층";
    const gg = Number(g) ? `지상${g}층` : "지상0층";
    return `${bb} / ${gg}`;
  }

  function parseScale(item) {
    // 신규 데이터 우선
    if (typeof item.scaleB === "number" || typeof item.scaleG === "number") {
      return { scaleB: item.scaleB ?? 0, scaleG: item.scaleG ?? 0 };
    }
    // 구버전 scale 텍스트 파싱
    const s = String(item.scale || "");
    const mB = s.match(/지하\s*(\d+)\s*층/);
    const mG = s.match(/지상\s*(\d+)\s*층/);
    return {
      scaleB: mB ? Number(mB[1]) : 0,
      scaleG: mG ? Number(mG[1]) : 0,
    };
  }

  function escAttr(s) {
    return String(s ?? "").replaceAll("&","&amp;").replaceAll('"',"&quot;").replaceAll("<","&lt;").replaceAll(">","&gt;");
  }

function deleteBuilding(id) {
  const arr = getBuildings();
  setBuildings(arr.filter((x) => x.id !== id));

  if (editId === id) clearForm();  // 현재 편집 중인 항목 삭제 시 초기화
  renderList();
  toast("삭제 완료");
}

function renderList() {
  let arr = getBuildings();

  // 🔥 실제 눌린 탭을 DOM에서 직접 읽음
  const activeTab = elTabs.querySelector(".tab.active");
  const activeType = activeTab ? activeTab.dataset.type : "shop";

  arr = arr.filter(x => x.type === activeType);

  arr.sort((a, b) =>
    (a.name || "").localeCompare((b.name || ""), "ko")
  );

  elList.innerHTML = "";
  elEmpty.style.display = arr.length ? "none" : "block";

  arr.forEach((item) => {
    const div = document.createElement("div");
    div.className = "item";

    const left = document.createElement("div");
    left.className = "meta";
    const nameDiv = document.createElement("div");
    nameDiv.className = "name";
    nameDiv.textContent = item.name;
    const subDiv = document.createElement("div");
    subDiv.className = "sub";
    subDiv.textContent = item.address || "(주소 미입력)";
    left.appendChild(nameDiv);
    left.appendChild(subDiv);

    const right = document.createElement("div");
    right.className = "item-actions";

    const editBtn = document.createElement("button");
    editBtn.className = "btn mini";
    editBtn.textContent = "수정";
    editBtn.onclick = () => loadToForm(item.id);

    const delBtn = document.createElement("button");
    delBtn.className = "btn mini danger";
    delBtn.textContent = "삭제";
    delBtn.onclick = () => deleteBuilding(item.id);

    right.appendChild(editBtn);
    right.appendChild(delBtn);

    div.appendChild(left);
    div.appendChild(right);
    elList.appendChild(div);
  });
}
  // ✅ 탭 클릭 이벤트 (상가/오피스텔 전환)
  if (elTabs) {
    elTabs.addEventListener("click", (e) => {
      const btn = e.target.closest(".tab");
      if (!btn) return;
      const t = btn.dataset.type;
      if (!t) return;

      currentType = t;
      editId = null;

      Array.from(elTabs.querySelectorAll(".tab")).forEach((b) =>
        b.classList.toggle("active", b.dataset.type === t)
      );

      renderTypeExtra(currentType, null);
      renderList();
    });
  }

  // ✅ 저장/새로작성 버튼 이벤트 연결
  const btnSave = document.getElementById("btnSave");
  const btnNew = document.getElementById("btnNew");

  if (btnSave) btnSave.addEventListener("click", saveBuilding);
  if (btnNew) btnNew.addEventListener("click", () => {
    clearForm();
    toast("새로작성");
  });

  // ✅ 최초 렌더
  renderTypeExtra(currentType, null);
  renderList();

})(); // ✅ 이게 없어서 SyntaxError 발생했음 (반드시 필요)
