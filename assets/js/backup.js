// assets/js/backup.js
// 백업 / 복원 / 엑셀 내보내기 — 모든 페이지 공통 사용

(function () {
  "use strict";

  // ── 로딩 오버레이 표시/숨김 ──────────────────────────────
  function showLoading() {
    const el = document.getElementById("loadingOverlay");
    if (el) { el.style.display = "flex"; }
  }
  function hideLoading() {
    const el = document.getElementById("loadingOverlay");
    if (el) { el.style.display = "none"; }
  }

  // ── JSON 백업 ────────────────────────────────────────────
  async function doBackup(btn) {
    if (btn) { btn.disabled = true; btn.textContent = "백업 중…"; }
    try {
      const data = {
        listings:       await DataUtil.getListings(),
        buildings:      await DataUtil.getBuildings(),
        customers:      await StorageUtil.getArray("customers"),
        scheduleEvents: await StorageUtil.getArray("scheduleEvents"),
        exportedAt:     new Date().toISOString(),
      };
      StorageUtil.downloadJson(
        "hitop-backup-" + new Date().toISOString().slice(0, 10) + ".json",
        data
      );
    } catch (e) {
      alert("백업 실패: " + e.message);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = "백업"; }
    }
  }

  // ── JSON 복원 ────────────────────────────────────────────
  async function doRestore(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!Array.isArray(data.listings)) throw new Error("올바른 백업 파일이 아닙니다.");
        const custCount  = Array.isArray(data.customers)      ? data.customers.length      : 0;
        const schedCount = Array.isArray(data.scheduleEvents) ? data.scheduleEvents.length : 0;
        if (!confirm(
          `매물 ${data.listings.length}건, 건물 ${(data.buildings||[]).length}건, ` +
          `고객 ${custCount}건, 일정 ${schedCount}건을 복원합니다.\n` +
          `기존 데이터가 덮어쓰입니다. 계속하시겠습니까?`
        )) return;

        showLoading();
        await DataUtil.setListings(data.listings);
        if (Array.isArray(data.buildings))      await StorageUtil.setArray("buildings",      data.buildings);
        if (Array.isArray(data.customers))      await StorageUtil.setArray("customers",      data.customers);
        if (Array.isArray(data.scheduleEvents)) await StorageUtil.setArray("scheduleEvents", data.scheduleEvents);
        alert("복원 완료!");
        location.reload();
      } catch (e) {
        alert("복원 실패: " + e.message);
      } finally {
        hideLoading();
      }
    };
    reader.readAsText(file);
  }

  // ── 엑셀 내보내기 ────────────────────────────────────────
  async function doExcel(btn) {
    if (btn) { btn.disabled = true; btn.textContent = "내보내는 중…"; }
    try {
      const listings  = await DataUtil.getListings();
      const buildings = await DataUtil.getBuildings();
      const customers = await StorageUtil.getArray("customers");

      // 숫자 포맷 헬퍼
      const won = n => (n && Number(n) > 0) ? Number(n).toLocaleString("ko-KR") + "만원" : "";

      // ── 매물 시트 ──
      const listRows = listings.map(x => ({
        "ID":           x.id || "",
        "유형":         x.type || "",
        "건물명":       x.buildingName || "",
        "호실":         x.unit || x.ho || "",
        "층수":         x.floorGroup || x.floor || "",
        "주소":         x.address || "",
        "거래유형":     x.dealType || "",
        "상태":         x.status || "",
        "전용면적(㎡)": x.areaExclusiveM2 || "",
        "전용면적(평)": x.areaExclusivePy || "",
        "분양면적(㎡)": x.areaSupplyM2 || "",
        "분양면적(평)": x.areaSupplyPy || "",
        "매매가(만원)": x.salePriceManwon || "",
        "전세가(만원)": x.jeonsePriceManwon || "",
        "보증금(만원)": x.depositManwon || "",
        "월세(만원)":   x.rentManwon || "",
        "관리비(만원)": x.maintenanceFeeManwon || "",
        "향":           x.direction || "",
        "현업종":       x.currentBiz || "",
        "소유주":       x.ownerName || "",
        "소유주연락처": x.ownerPhone || "",
        "임차인":       x.tenantName || "",
        "임차인연락처": x.tenantPhone || "",
        "계약만료일":   x.leaseEnd || "",
        "매물나옴":     x.isListed ? "Y" : "N",
        "등록일":       (x.createdAt || "").slice(0, 10),
        "수정일":       (x.updatedAt || "").slice(0, 10),
      }));

      // ── 건물 시트 ──
      const bldRows = buildings.map(b => ({
        "ID":       b.id || "",
        "유형":     b.type || "",
        "건물명":   b.name || "",
        "주소":     b.address || "",
        "사용승인일": b.approved || "",
        "주차대수": b.parking || "",
        "지하층수": b.undergroundFloors || "",
        "지상층수": b.aboveGroundFloors || "",
      }));

      // ── 고객 시트 ──
      const custRows = customers.map(c => ({
        "ID":       c.id || "",
        "이름":     c.name || "",
        "연락처":   c.phone || "",
        "유형":     c.type || "",
        "관심유형": c.interestType || "",
        "예산(만원)": c.budgetManwon || "",
        "메모":     c.memo || "",
        "등록일":   (c.createdAt || "").slice(0, 10),
      }));

      // ── SheetJS로 xlsx 생성 ──
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(listRows),  "매물목록");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(bldRows),   "건물목록");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(custRows),  "고객목록");

      const fileName = "하이탑부동산_" + new Date().toISOString().slice(0, 10) + ".xlsx";
      XLSX.writeFile(wb, fileName);

    } catch (e) {
      alert("엑셀 내보내기 실패: " + e.message);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = "엑셀 내보내기"; }
    }
  }

  // ── DOMContentLoaded 후 이벤트 바인딩 ───────────────────
  document.addEventListener("DOMContentLoaded", () => {
    // 백업 버튼 (id: btnBackup 또는 btnExport)
    const elBackup = document.getElementById("btnBackup") || document.getElementById("btnExport");
    if (elBackup) elBackup.addEventListener("click", () => doBackup(elBackup));

    // 복원 버튼
    const elRestore = document.getElementById("btnRestore");
    if (elRestore) elRestore.addEventListener("change", (e) => doRestore(e.target.files[0]));

    // 엑셀 내보내기 버튼
    const elExcel = document.getElementById("btnExcel");
    if (elExcel) elExcel.addEventListener("click", () => doExcel(elExcel));
  });

})();
