// assets/js/estimate-page.js — 견적서 전용 페이지 컨트롤러
(async function () {
  "use strict";

  const qs      = new URLSearchParams(location.search);
  const id      = qs.get("id");

  if (!id) { alert("매물 id가 없습니다."); location.href = "index.html"; return; }

  // 매물 조회
  const listings = await DataUtil.getListings();
  const listing  = listings.find(x => x.id === id);
  if (!listing) { alert("매물을 찾을 수 없습니다."); location.href = "index.html"; return; }

  // 상단 제목 업데이트
  const unit  = listing.unit || listing.ho || "";
  const title = [listing.buildingName, unit, "견적서"].filter(Boolean).join(" ");
  document.getElementById("estPageTitle").textContent = title;
  document.getElementById("estPageSub").textContent   =
    listing.address || listing.buildingName || "견적서";

  // 뒤로 버튼
  document.getElementById("btnBack").addEventListener("click", () => history.back());

  // ── opts 읽기 ──────────────────────────────────────
  function getOpts() {
    return {
      ltvPct:       Number(document.getElementById("ef_ltvPct").value)     || 60,
      interestRate: Number(document.getElementById("ef_intRate").value)    || 4.2,
      acqTaxRate:   Number(document.getElementById("ef_acqTaxRate").value) || 4.6,
      regRate:      0,
    };
  }

  // ── 미리보기 렌더 ──────────────────────────────────
  async function doPreview() {
    await window.EstimateUtil.preview(listing, getOpts());
    document.getElementById("estCtrlHint").style.color = "#4caf50";
    document.getElementById("estCtrlHint").innerHTML   =
      "✅ 견적서가 업데이트되었습니다.";
  }

  // ── 인쇄 ──────────────────────────────────────────
  async function doPrint() {
    await window.EstimateUtil.renderAndPrint(listing, getOpts());
  }

  // 값 변경 시 힌트 표시
  ["ef_ltvPct","ef_intRate","ef_acqTaxRate"].forEach(id => {
    document.getElementById(id).addEventListener("input", () => {
      const hint = document.getElementById("estCtrlHint");
      hint.style.color   = "#e67e22";
      hint.innerHTML = "⚠️ 값이 변경되었습니다. <strong>미리보기 갱신</strong> 버튼을 눌러 업데이트하세요.";
    });
  });

  document.getElementById("btnRefresh").addEventListener("click", async () => {
    const btn = document.getElementById("btnRefresh");
    btn.textContent = "⏳ 갱신 중...";
    btn.disabled    = true;
    await doPreview();
    btn.textContent = "🔄 미리보기 갱신";
    btn.disabled    = false;
  });

  document.getElementById("btnPrintTop").addEventListener("click", async () => {
    const btn = document.getElementById("btnPrintTop");
    btn.textContent = "⏳ 준비 중...";
    btn.disabled    = true;
    await doPrint();
    btn.textContent = "🖨️ 인쇄 출력";
    btn.disabled    = false;
  });

  // 최초 렌더
  await doPreview();
})();
