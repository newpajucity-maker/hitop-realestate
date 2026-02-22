// assets/js/data.js
// ── 비동기(async/await) 데이터 레이어 ───────────────────────────────
// StorageUtil(storage.js)의 getArray/setArray/upsertOne/deleteOne이
// 모두 Promise를 반환하므로, 이 파일의 모든 데이터 함수도 async로 선언함.
//
// ※ 함수 이름은 기존과 동일하게 유지 → 다른 파일 변경 최소화
// ※ 호출하는 쪽(list.js, register.js 등)에서 await를 붙이기만 하면 됨

(function () {
  "use strict";

  const Data = {};

  // localStorage 키 (테이블 매핑은 storage.js의 TABLE 객체가 담당)
  Data.KEY_BUILDINGS = "buildings";
  Data.KEY_LISTINGS  = "listings";

  // ── Buildings ────────────────────────────────────────────────────

  // 건물 전체 조회
  Data.getBuildings = async function () {
    return await StorageUtil.getArray(Data.KEY_BUILDINGS);
  };

  // 건물 단건 조회 (buildingId로 찾기)
  Data.findBuildingById = async function (id) {
    if (!id) return null;
    const arr = await Data.getBuildings();
    return arr.find(b => b.id === id) || null;
  };

  // ── Listings ─────────────────────────────────────────────────────

  // 매물 전체 조회 (null/undefined 항목 필터링 포함)
  Data.getListings = async function () {
    const arr = await StorageUtil.getArray(Data.KEY_LISTINGS);
    return arr.filter(x => x && typeof x === "object");
  };

  // 매물 전체 교체 저장
  Data.setListings = async function (arr) {
    await StorageUtil.setArray(Data.KEY_LISTINGS, arr);
  };

  // 매물 단건 저장/수정 (upsertOne으로 전체 교체 없이 효율적 처리)
  Data.upsertListing = async function (record) {
    await StorageUtil.upsertOne(Data.KEY_LISTINGS, record);
  };

  // 매물 단건 삭제 (전체 교체 없이 해당 id만 삭제)
  Data.deleteListing = async function (id) {
    await StorageUtil.deleteOne(Data.KEY_LISTINGS, id);
  };

  // ── Utils (동기 · 변경 없음) ──────────────────────────────────────

  Data.M2_PER_PY = 3.305785;

  Data.toPy = function (m2) {
    const n = Number(m2);
    if (!isFinite(n)) return "";
    return +(n / Data.M2_PER_PY).toFixed(2);
  };

  Data.toM2 = function (py) {
    const n = Number(py);
    if (!isFinite(n)) return "";
    return +(n * Data.M2_PER_PY).toFixed(2);
  };

  Data.toNumberOrZero = function (v) {
    const n = Number(String(v ?? "").trim());
    return isFinite(n) ? n : 0;
  };

  Data.cleanText = function (v) {
    return String(v ?? "").trim().replace(/\s+/g, " ");
  };

  Data.nowISO = function () {
    return new Date().toISOString();
  };

  Data.newListingId = function () {
    return StorageUtil.uid("l");
  };

  Data.DIRECTIONS = [
    "남향","남동향","남서향","동향","서향","북동향","북서향","북향","확인중"
  ];

  Data.SHOP_FLOORS = [
    "B2","B1","1F","2F","3F","4F","5F","6F","7F","8F","9F","10F"
  ];

  Data.STATUS        = ["거래가능","계약진행","보류","완료"];
  Data.DEALTYPE_COMMON = ["매매","전세","월세","임대","분양"];

  window.DataUtil = Data;
})();
