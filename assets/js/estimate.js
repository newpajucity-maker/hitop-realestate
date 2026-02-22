// assets/js/estimate.js  ── 실무형 견적서 v3 (퍼스트메디컬 공식 반영)
//
// ★ 핵심 공식 (사진 검증 완료)
//
//   평당가     = 총분양가(VAT포함) ÷ 분양평수
//   대출금     = 순분양가(VAT제외) × 대출비율%
//   기타비용   = 순분양가(VAT제외) × (취득세율 + 등기비율)%
//   월이자     = 대출금 × 이자율% ÷ 12
//
//   [대출시]  투자금 = 순분양가 - 대출금 - 보증금        ← VAT·기타비용 미포함
//             수익률 = (월세 - 월이자) × 12 ÷ 투자금 × 100
//
//   [미대출시] 투자금 = 순분양가 - 보증금                ← VAT·기타비용 미포함
//             수익률 = 월세 × 12 ÷ 투자금 × 100
//
//   ※ 관리비는 수익률 계산에서 완전 제외, 임대 섹션에 "별도" 표기
(function () {
  "use strict";

  // ════════════════════════════════════════════════════════════════
  //  공개 API
  // ════════════════════════════════════════════════════════════════
  const Estimate = {};

  Estimate.renderAndPrint = async function (listing, opts = {}) {
    await fillEstimate(listing, opts);
    window.print();
  };

  Estimate.preview = async function (listing, opts = {}) {
    await fillEstimate(listing, opts);
  };

  window.EstimateUtil = Estimate;

  // ════════════════════════════════════════════════════════════════
  //  compute()  ── 퍼스트메디컬 견적서와 동일한 계산 로직
  // ════════════════════════════════════════════════════════════════
  function compute(x, opts) {
    // ── 입력값 ──────────────────────────────────────────────────
    const vatMode    = x.vatMode || "해당없음";
    const vatRate    = fin(x.vatRate,           5.5); // 건물분 VAT (%)
    const acqTaxRate = fin(opts.acqTaxRate,     4.6); // 취득세율 (%)
    const regRate    = fin(opts.regRate,         0.4); // 등기비율 (%) ← 합산 4.6+0.4=5.0%
    const ltvPct     = fin(opts.ltvPct,          60);  // 대출비율 (%)
    const intRate    = fin(opts.interestRate,    4.2); // 연 이자율 (%)
    const deposit    = fin(x.depositManwon,       0);  // 보증금 (만원)
    const monthlyRent= fin(x.rentManwon,          0);  // 월세 (만원)

    // ── ① 자금일정 ───────────────────────────────────────────────
    const basePrice  = pickBasePrice(x);               // 순분양가 (VAT 제외, 만원)
    const vatAmt     = vatMode === "별도"
                       ? round2(basePrice * vatRate / 100)
                       : 0;
    const totalPrice = basePrice + vatAmt;             // 총분양가 (VAT포함, 만원)

    // ── ② 평당가 (P1-02: Math.round) ─────────────────────────────
    // ★ 평당가 = 순분양가(VAT제외) ÷ 분양평수  (퍼스트메디컬 검증)
    //   사진: 1,037,000,000 ÷ 82.99평 = 12,495,805원 ✅
    const supplyPy   = fin(x.areaSupplyPy, 0);
    const exclPy     = fin(x.areaExclusivePy, 0);
    const pyForCalc  = supplyPy > 0 ? supplyPy : exclPy;
    const pricePerPy = pyForCalc > 0
                       ? Math.round(basePrice / pyForCalc)   // VAT 제외 순분양가 기준
                       : null;

    // ── ③ 기타비용  (기준: 순분양가, VAT 제외) ───────────────────
    const acqTax  = round2(basePrice * acqTaxRate / 100);
    const regCost = round2(basePrice * regRate    / 100);
    const etcTotal= round2(acqTax + regCost);

    // ── ④ 대출  (기준: 순분양가, VAT 제외) ───────────────────────
    const loanAmt    = round2(basePrice * ltvPct / 100);
    const monthlyInt = round2(loanAmt * intRate / 100 / 12);

    // ── ⑥ 투자금 & 수익률 (VAT·기타비용 미포함) ─────────────────
    //
    //  [대출시]  투자금 = 순분양가 - 대출금 - 보증금
    //  [미대출시] 투자금 = 순분양가 - 보증금
    const investWithLoan    = basePrice - loanAmt    - deposit;
    const investWithoutLoan = basePrice              - deposit;

    const netMonthlyWithLoan    = monthlyRent - monthlyInt;
    const netMonthlyWithoutLoan = monthlyRent;

    const yieldWithLoan = (investWithLoan > 0 && netMonthlyWithLoan > 0)
      ? netMonthlyWithLoan * 12 / investWithLoan * 100 : 0;
    const yieldWithoutLoan = (investWithoutLoan > 0 && netMonthlyWithoutLoan > 0)
      ? netMonthlyWithoutLoan * 12 / investWithoutLoan * 100 : 0;

    // ── 납입일정 (계약금/중도금1/중도금2/잔금) ────────────────────
    const schedule = buildSchedule(x, basePrice, vatAmt, opts);

    return {
      // 자금
      basePrice, vatAmt, totalPrice, vatMode, vatRate,
      // 평당가
      pricePerPy, supplyPy, exclPy,
      // 기타비용
      acqTaxRate, regRate, acqTax, regCost, etcTotal,
      // 대출
      ltvPct, loanAmt, intRate, monthlyInt,
      // 임대
      deposit, monthlyRent,
      // 투자금
      investWithLoan, investWithoutLoan,
      // 순월수익
      netMonthlyWithLoan, netMonthlyWithoutLoan,
      // 연순수익
      annualNetWithLoan:    round2(netMonthlyWithLoan    * 12),
      annualNetWithoutLoan: round2(netMonthlyWithoutLoan * 12),
      // 수익률
      yieldWithLoan, yieldWithoutLoan,
      // 납입일정
      schedule,
    };
  }

  // ── 납입일정 생성 ─────────────────────────────────────────────
  function buildSchedule(x, basePrice, vatAmt, opts) {
    // opts.payPlan(폼 입력) → x.estimate.payPlan(저장값) → 기본값 순으로 우선 적용
    const pp = opts.payPlan || (x.estimate || {}).payPlan || {};
    const contract = fin(pp.contractPct, 20);
    const interim1 = fin(pp.interim1Pct, 20);
    const interim2 = fin(pp.interim2Pct,  0);
    const balance  = 100 - contract - interim1 - interim2;

    const pct2row = (label, pct) => {
      if (pct <= 0) return null;
      const base = round2(basePrice * pct / 100);
      const vat  = round2(vatAmt    * pct / 100);
      return { label, pct, base, vat, total: round2(base + vat) };
    };

    return [
      pct2row("계 약 금",  contract),
      pct2row("중도금 1",  interim1),
      pct2row("중도금 2",  interim2),
      pct2row("잔    금",  balance),
    ].filter(Boolean);
  }

  // ════════════════════════════════════════════════════════════════
  //  fillEstimate()  ── HTML 렌더링
  // ════════════════════════════════════════════════════════════════
  async function fillEstimate(x, opts) {
    const root = document.getElementById("estimatePrint");
    if (!root) return;

    const c    = compute(x, opts);
    const plan = await pickPlanUrl(x);
    const today   = new Date();
    const dateStr = `${today.getFullYear()}.${pad2(today.getMonth()+1)}.${pad2(today.getDate())}`;

    const titleParts = [x.buildingName, x.unit || x.ho].filter(Boolean).join(" ");
    const headTitle  = titleParts ? `${titleParts} 견적서` : "매물 견적서";

    const exArea  = fmtArea(x.areaExclusiveM2, x.areaExclusivePy);
    const supArea = fmtArea(x.areaSupplyM2,    x.areaSupplyPy);

    // 납입일정 행
    const schedRows = c.schedule.map(s =>
      `<tr>
        <td>${esc(s.label)}</td>
        <td class="right">${s.pct}%</td>
        <td class="right">${manW(s.base)}</td>
        <td class="right">${s.vat > 0 ? manW(s.vat) : "-"}</td>
        <td class="right bold">${manW(s.total)}</td>
      </tr>`
    ).join("");

    root.innerHTML = `
<!-- ═══ 헤더 ═══ -->
<div class="est-header">
  <div class="est-header-left">
    <div class="est-header-badge">하이탑부동산 견적서</div>
    <div class="est-header-title">${esc(headTitle)}</div>
  </div>
  <div class="est-header-date">출력일: ${dateStr}</div>
</div>

${plan.url ? `
<div class="est-figure">
  <img src="${escAttr(plan.url)}" alt="도면">
  <div class="est-caption">${esc(plan.caption)}</div>
</div>` : ""}

<!-- ═══ ① 개요 ═══ -->
<div class="est-section">
  <div class="est-section-title">■ 개요</div>
  <table class="est-table est-overview">
    <tbody>
      <tr>
        <th>주&nbsp;&nbsp;&nbsp;소</th>
        <td colspan="3">${esc(x.address || "-")}</td>
        <th>호&nbsp;&nbsp;&nbsp;실</th>
        <td class="highlight-cell">${esc(x.unit || x.ho || "-")}</td>
      </tr>
      <tr>
        <th>전용면적</th>
        <td>${esc(exArea)}</td>
        <th>분양면적</th>
        <td>${esc(supArea)}</td>
        <th>건물용도</th>
        <td>${esc(x.currentBiz || x.dealType || "-")}</td>
      </tr>
      <tr>
        <th>분&nbsp;&nbsp;양&nbsp;&nbsp;가</th>
        <td class="highlight-cell bold">${manW(c.basePrice)}</td>
        <th>부가세(건물분) ${c.vatMode === "별도" ? c.vatRate+"%" : ""}</th>
        <td>${c.vatMode === "별도" ? manW(c.vatAmt) : (c.vatMode === "포함" ? "포함" : "해당없음")}</td>
        <th>총&nbsp;분&nbsp;양&nbsp;가</th>
        <td class="highlight-cell bold">${manW(c.totalPrice)}</td>
      </tr>
      <tr>
        <th>평&nbsp;&nbsp;당&nbsp;&nbsp;가</th>
        <td class="bold" colspan="5">
          ${c.pricePerPy !== null
            ? `${Math.round(c.pricePerPy).toLocaleString("ko-KR")}원/평`
              + (c.supplyPy > 0 ? ` &nbsp;<span class="est-note-inline">(분양 ${c.supplyPy}평 기준)</span>` : "")
            : "-"}
        </td>
      </tr>
    </tbody>
  </table>
</div>

<!-- ═══ ② 자금 및 납입일정 ═══ -->
<div class="est-section">
  <div class="est-section-title">■ 자금 및 납입일정 &nbsp;<span class="est-unit-label">[단위: 원]</span></div>
  <table class="est-table est-schedule">
    <thead>
      <tr>
        <th>구 분</th><th class="right">비 율</th>
        <th class="right">분 양 가</th><th class="right">부 가 세</th>
        <th class="right">합 계</th>
      </tr>
    </thead>
    <tbody>
      ${schedRows}
    </tbody>
    <tfoot>
      <tr class="foot-total">
        <td>합&nbsp;&nbsp;&nbsp;계</td>
        <td class="right">100%</td>
        <td class="right">${manW(c.basePrice)}</td>
        <td class="right">${c.vatAmt > 0 ? manW(c.vatAmt) : "-"}</td>
        <td class="right bold">${manW(c.totalPrice)}</td>
      </tr>
    </tfoot>
  </table>
</div>

<!-- ═══ ③ 기타비용 ═══ -->
<div class="est-section">
  <div class="est-section-title">■ 기타비용</div>
  <table class="est-table">
    <tbody>
      <tr>
        <th>취득세 (분양가 × ${c.acqTaxRate.toFixed(1)}%)</th>
        <td class="right">${manW(c.acqTax)}</td>
        <th>등기비용 (분양가 × ${c.regRate.toFixed(1)}%)</th>
        <td class="right">${c.regCost > 0 ? manW(c.regCost) : "별도"}</td>
      </tr>
      <tr class="row-bold">
        <th colspan="3">기타비용 합계 (분양가 × ${(c.acqTaxRate + c.regRate).toFixed(1)}%)</th>
        <td class="right">${manW(c.etcTotal)}</td>
      </tr>
    </tbody>
  </table>
  <div class="est-note">※ 기타비용 기준: VAT 제외 순분양가. 취득세율은 건물 용도·면적에 따라 달라질 수 있습니다.</div>
</div>

<!-- ═══ ④ 대출 ═══ -->
<div class="est-section">
  <div class="est-section-title">■ 대출</div>
  <table class="est-table">
    <tbody>
      <tr>
        <th>대 출 액 &nbsp; ${c.ltvPct.toFixed(0)}%</th>
        <td class="right bold">${c.loanAmt > 0 ? manW(c.loanAmt) : "미대출"}</td>
        <th>월 이 자 &nbsp; ${c.intRate.toFixed(1)}%</th>
        <td class="right bold">${c.monthlyInt > 0 ? manW(c.monthlyInt) : "-"}</td>
      </tr>
    </tbody>
  </table>
  <div class="est-note">※ 대출 기준: VAT 제외 순분양가 × ${c.ltvPct.toFixed(0)}%</div>
</div>

<!-- ═══ ⑤ 임대(예상) ═══ -->
<div class="est-section">
  <div class="est-section-title">■ 임대(예상) &nbsp;<span class="est-unit-label">[VAT별도]</span></div>
  <table class="est-table">
    <tbody>
      <tr>
        <th>보 증 금</th>
        <td class="right highlight-cell bold">${man0W(c.deposit)}</td>
        <th>월 &nbsp; 세</th>
        <td class="right highlight-cell bold">${c.monthlyRent > 0 ? manW(c.monthlyRent) : "-"}</td>
      </tr>
      <tr>
        <th>관 리 비</th>
        <td colspan="3" class="right">별도</td>
      </tr>
    </tbody>
  </table>
</div>

<!-- ═══ ⑥ 투자금 & 수익률 ═══ -->
<div class="est-section">
  <div class="est-section-title">■ 투자금 &amp; 수익률 &nbsp;<span class="est-unit-label">[VAT, 기타비용 미포함]</span></div>
  <table class="est-compare-table">
    <thead>
      <tr>
        <th></th>
        <th class="center">대출시 (LTV ${c.ltvPct.toFixed(0)}%)</th>
        <th class="center">미대출시</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <th>투자금액</th>
        <td class="right highlight-cell bold">${manW(c.investWithLoan)}</td>
        <td class="right bold">${manW(c.investWithoutLoan)}</td>
      </tr>
      <tr>
        <th>월 순수익<br><span class="sub-label">(월세 − 월이자)</span></th>
        <td class="right">${c.ltvPct > 0 ? manW(c.netMonthlyWithLoan) : "-"}</td>
        <td class="right">${manW(c.netMonthlyWithoutLoan)}</td>
      </tr>
      <tr>
        <th>연 순수익</th>
        <td class="right">${c.ltvPct > 0 && c.annualNetWithLoan > 0 ? manW(c.annualNetWithLoan) : "-"}</td>
        <td class="right">${c.annualNetWithoutLoan > 0 ? manW(c.annualNetWithoutLoan) : "-"}</td>
      </tr>
      <tr class="yield-row-highlight">
        <th>수 익 률</th>
        <td class="right big-yield">${esc(c.ltvPct > 0 ? fmtPct(c.yieldWithLoan) : "-")}</td>
        <td class="right big-yield">${esc(fmtPct(c.yieldWithoutLoan))}</td>
      </tr>
    </tbody>
  </table>
  <div class="est-note">
    ※ 투자금(대출시) = 분양가 − 대출금 − 보증금<br>
    ※ 투자금(미대출시) = 분양가 − 보증금<br>
    ※ 수익률 = (월세 − 월이자) × 12 ÷ 투자금 × 100 &nbsp;|&nbsp; 관리비 미포함
  </div>
</div>

<!-- ═══ 푸터 ═══ -->
<div class="est-footer">
  <div class="est-footer-main">하이탑부동산 &nbsp;|&nbsp; ☎ 031-949-8969</div>
  <div class="est-footer-note">본 견적서는 참고용이며 실제 거래 조건과 다를 수 있습니다.</div>
</div>`;
  }

  // ════════════════════════════════════════════════════════════════
  //  입력폼 (P2-07) ── detail.html 하단 견적 조정 패널
  // ════════════════════════════════════════════════════════════════
  Estimate.renderInputForm = function (containerId, listing) {
    const wrap = document.getElementById(containerId);
    if (!wrap) return;

    const est = (listing.estimate || {});

    wrap.innerHTML = `
<div class="est-form-box">
  <div class="est-form-title">📊 수익률 견적 입력</div>
  <div class="est-form-section-label">▸ 대출 / 비용</div>
  <div class="est-form-grid">
    <div class="ef-group">
      <label>대출비율 (%)</label>
      <input id="ef_ltvPct"      type="number" step="1"   min="0" max="100"
             value="${fin(est.ltvPct,        60)}" placeholder="60">
    </div>
    <div class="ef-group">
      <label>이자율 (연 %)</label>
      <input id="ef_intRate"     type="number" step="0.1" min="0"
             value="${fin(est.interestRate,  4.2)}" placeholder="4.2">
    </div>
    <div class="ef-group">
      <label>취득세율 (%)</label>
      <input id="ef_acqTaxRate"  type="number" step="0.1" min="0"
             value="${fin(est.acqTaxRate,    4.6)}" placeholder="4.6">
    </div>
    <div class="ef-group">
      <label>등기비율 (%) <span style="font-size:8pt;color:#888;">취득세+등기=합산%</span></label>
      <input id="ef_regRate"     type="number" step="0.1" min="0"
             value="${fin(est.regRate,        0.4)}" placeholder="0.4">
    </div>
  </div>
  <div class="est-form-section-label" style="margin-top:10px;">▸ 납입일정 비율 (%)</div>
  <div class="est-form-grid">
    <div class="ef-group">
      <label>계약금 (%)</label>
      <input id="ef_contractPct" type="number" step="1" min="0" max="100"
             value="${fin((est.payPlan||{}).contractPct, 20)}" placeholder="20">
    </div>
    <div class="ef-group">
      <label>중도금 1 (%)</label>
      <input id="ef_interim1Pct" type="number" step="1" min="0" max="100"
             value="${fin((est.payPlan||{}).interim1Pct, 20)}" placeholder="20">
    </div>
    <div class="ef-group">
      <label>중도금 2 (%)</label>
      <input id="ef_interim2Pct" type="number" step="1" min="0" max="100"
             value="${fin((est.payPlan||{}).interim2Pct,  0)}" placeholder="0">
    </div>
    <div class="ef-group">
      <label>잔금 (자동계산)</label>
      <input id="ef_balancePct"  type="number" readonly
             style="background:#f0f0f0; color:#888;" placeholder="60">
    </div>
  </div>
  <div class="est-form-actions">
    <button class="btn"         type="button" id="ef_btnPreview">미리보기 갱신</button>
    <button class="btn primary" type="button" id="ef_btnPrint">인쇄 출력</button>
  </div>
</div>`;

    // 잔금 자동 계산
    function updateBalance() {
      const c = Number(document.getElementById("ef_contractPct").value) || 0;
      const i1= Number(document.getElementById("ef_interim1Pct").value)|| 0;
      const i2= Number(document.getElementById("ef_interim2Pct").value)|| 0;
      const b = 100 - c - i1 - i2;
      document.getElementById("ef_balancePct").value = b >= 0 ? b : 0;
    }
    ["ef_contractPct","ef_interim1Pct","ef_interim2Pct"].forEach(id => {
      document.getElementById(id).addEventListener("input", updateBalance);
    });
    updateBalance();

    function getOpts() {
      return {
        ltvPct:       Number(document.getElementById("ef_ltvPct").value)      || 60,
        interestRate: Number(document.getElementById("ef_intRate").value)     || 4.2,
        acqTaxRate:   Number(document.getElementById("ef_acqTaxRate").value)  || 4.6,
        regRate:      Number(document.getElementById("ef_regRate").value)     || 0.4,
        payPlan: {
          contractPct: Number(document.getElementById("ef_contractPct").value)|| 20,
          interim1Pct: Number(document.getElementById("ef_interim1Pct").value)|| 20,
          interim2Pct: Number(document.getElementById("ef_interim2Pct").value)||  0,
        },
      };
    }

    document.getElementById("ef_btnPreview").addEventListener("click", async () => {
      await Estimate.preview(listing, getOpts());
    });
    document.getElementById("ef_btnPrint").addEventListener("click", async () => {
      await Estimate.renderAndPrint(listing, getOpts());
    });

    // 최초 자동 렌더
    Estimate.preview(listing, getOpts());
  };

  // ════════════════════════════════════════════════════════════════
  //  CSS 자동 주입
  // ════════════════════════════════════════════════════════════════
  (function injectCSS() {
    if (document.getElementById("estimateCssV3")) return;
    const s = document.createElement("style");
    s.id = "estimateCssV3";
    s.textContent = `
/* ── 헤더 ── */
.est-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8pt; }
.est-header-badge { display:inline-block; background:#1c3d6e; color:#fff; font-size:9pt; padding:2pt 8pt; border-radius:3pt; margin-bottom:3pt; }
.est-header-title { font-size:15pt; font-weight:700; }
.est-header-date  { font-size:9pt; color:#555; padding-top:4pt; }

/* ── 섹션 ── */
.est-section { margin-bottom:11pt; page-break-inside:avoid; }
.est-section-title { font-size:10pt; font-weight:700; background:#e8eef8; border-left:4px solid #1c3d6e; padding:3pt 8pt; margin-bottom:5pt; }
.est-unit-label { font-size:8pt; font-weight:400; color:#555; }
.est-note-inline { font-size:8pt; color:#777; }

/* ── 기본 테이블 ── */
.est-table { width:100%; border-collapse:collapse; font-size:9pt; }
.est-table th, .est-table td { border:1px solid #c8c8c8; padding:3.5pt 7pt; }
.est-table th { background:#f4f6fb; font-weight:500; }
.est-table td { text-align:right; }
.est-table .bold { font-weight:700; }
.est-table .right { text-align:right; }
.est-table .highlight-cell { background:#fff7cc; font-weight:700; }
.est-table .row-bold th,
.est-table .row-bold td { font-weight:700; background:#dde3f0; }

/* ── 개요 테이블 ── */
.est-overview th { width:12%; text-align:center; }
.est-overview td { text-align:left; padding-left:8pt; }
.est-overview .highlight-cell { text-align:right; }

/* ── 납입일정 테이블 ── */
.est-schedule thead th { background:#1c3d6e; color:#fff; text-align:right; }
.est-schedule thead th:first-child { text-align:left; }
.est-schedule tfoot .foot-total td { background:#dde3f0; font-weight:700; }
.est-schedule tfoot .foot-total td:first-child { text-align:left; }

/* ── 비교 테이블 (⑥) ── */
.est-compare-table { width:100%; border-collapse:collapse; font-size:9.5pt; }
.est-compare-table th, .est-compare-table td { border:1px solid #c8c8c8; padding:4pt 8pt; }
.est-compare-table thead th { background:#1c3d6e; color:#fff; text-align:center; }
.est-compare-table tbody th { background:#f4f6fb; text-align:left; width:32%; font-weight:500; }
.est-compare-table .right { text-align:right; }
.est-compare-table .center { text-align:center; }
.est-compare-table .highlight-cell { background:#fff7cc; }
.est-compare-table .bold { font-weight:700; }
.est-compare-table .yield-row-highlight th,
.est-compare-table .yield-row-highlight td { background:#e3fafc; font-weight:700; }
.est-compare-table .big-yield { font-size:13pt; color:#1864ab; }
.sub-label { font-size:7.5pt; font-weight:400; color:#666; }

/* ── 도면 ── */
.est-figure { text-align:center; margin-bottom:10pt; }
.est-figure img { max-width:100%; max-height:180pt; }
.est-caption { font-size:8pt; color:#555; margin-top:3pt; }

/* ── 노트 ── */
.est-note { font-size:8pt; color:#666; margin-top:4pt; line-height:1.7; }

/* ── 입력폼 ── */
.est-form-box { border:2px solid #1c3d6e; border-radius:8px; padding:16px; margin-top:18px; background:#f7f9ff; }
.est-form-title { font-weight:700; font-size:11pt; margin-bottom:12px; color:#1c3d6e; }
.est-form-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:10px 24px; }
.ef-group label { display:block; font-size:9pt; color:#444; margin-bottom:3px; }
.ef-group input { width:100%; box-sizing:border-box; border:1px solid #ced4da; border-radius:4px; padding:5px 8px; font-size:10pt; }
.est-form-actions { margin-top:14px; display:flex; gap:8px; justify-content:flex-end; }
.btn.primary { background:#1c3d6e; color:#fff; border:none; padding:6px 16px; border-radius:4px; cursor:pointer; font-size:10pt; }
.btn { background:#fff; border:1px solid #1c3d6e; color:#1c3d6e; padding:6px 16px; border-radius:4px; cursor:pointer; font-size:10pt; }

/* ── 푸터 ── */
.est-footer { border-top:1.5pt solid #333; padding-top:6pt; margin-top:14pt; display:flex; justify-content:space-between; font-size:8.5pt; }
.est-footer-main { font-weight:700; }
.est-footer-note { color:#888; }

@media print {
  .est-form-box { display:none !important; }
  .est-section-title,
  .est-compare-table thead th,
  .est-schedule thead th,
  .est-header-badge { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
}`;
    document.head.appendChild(s);
  })();

  // ════════════════════════════════════════════════════════════════
  //  헬퍼
  // ════════════════════════════════════════════════════════════════
  function pickBasePrice(x) {
    const s = fin(x.salePriceManwon,    0);
    const j = fin(x.jeonsePriceManwon,  0);
    return s > 0 ? s : (j > 0 ? j : 0);
  }

  async function pickPlanUrl(x) {
    const b = x.buildingId ? await DataUtil.findBuildingById(x.buildingId) : null;
    if (x.type === "shop" && b?.floorplans && x.floor) {
      const url = b.floorplans[x.floor];
      if (url) return { url, caption: `${x.floor} 평면도` };
    }
    if ((x.type === "officetel" || x.type === "apartment") && b?.layouts?.length) {
      return { url: b.layouts[0], caption: "호수 배치도" };
    }
    return { url: "", caption: "" };
  }

  function row(k, v) {
    return `<tr><th>${esc(k)}</th><td>${esc(String(v ?? ""))}</td></tr>`;
  }

  // 원 단위 표기 (만원 → 원 변환, Math.round)
  function manW(n) {
    const v = Number(n);
    if (!isFinite(v)) return "-";
    return Math.round(v * 10000).toLocaleString("ko-KR") + "원";
  }
  // man0: 0 도 "0원" 표시 (P1-07 보증금 0원 복원)
  function man0W(n) {
    const v = Number(n);
    if (!isFinite(v)) return "-";
    return Math.round(v * 10000).toLocaleString("ko-KR") + "원";
  }

  function fmtArea(m2, py) {
    const mm = m2 && Number(m2) > 0 ? `${fmtNum(m2)}㎡` : "";
    const pp = py && Number(py) > 0 ? `${fmtNum(py)}평`  : "";
    if (!mm && !pp) return "—";
    return [pp, mm ? `${mm}` : ""].filter(Boolean).join("  ");
  }
  function fmtNum(v) {
    const n = Number(v); if (!isFinite(n)) return String(v ?? "");
    return String(v).includes(".") ? n.toFixed(2).replace(/\.00$/, "") : n.toLocaleString("ko-KR");
  }
  function fmtPct(v) {
    const n = Number(v);
    if (!isFinite(n) || n <= 0) return "-";
    return n.toFixed(1) + "%";
  }
  function fin(v, fallback) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }
  function round2(n) { return Math.round(Number(n) * 100) / 100; }
  function pad2(n)   { return String(n).padStart(2, "0"); }
  function esc(s)    { return String(s ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;"); }
  function escAttr(s){ return String(s ?? "").replaceAll("&","&amp;").replaceAll('"',"&quot;").replaceAll("<","&lt;").replaceAll(">","&gt;"); }

})();
