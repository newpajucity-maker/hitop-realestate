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

    const unitPart   = x.unit || x.ho || "";
    const titleParts = [x.buildingName, unitPart].filter(Boolean).join(" ");
    const dealLabel  = x.dealType === "매매" || x.dealType === "분양" ? "분양" : "임대";
    const headTitle  = titleParts
      ? `${titleParts} ${dealLabel} 견적서`
      : "매물 견적서";

    const exArea  = fmtArea(x.areaExclusiveM2, x.areaExclusivePy);
    const supArea = fmtArea(x.areaSupplyM2,    x.areaSupplyPy);

    // 납입일정 행 - 납부시기 포함
    const schedRows = c.schedule.map((s, i) => {
      const dueTimes = ["계약일", "중도금 납부일", "중도금 납부일", "준공 후 잔금지일"];
      const dueLabel = s.label.trim().startsWith("잔") ? "준공 후 잔금지일" : dueTimes[i] || "";
      return `<tr>
        <td class="sched-label">${esc(s.label)}</td>
        <td class="right">${s.pct}%</td>
        <td class="right">${manW(s.base)}</td>
        <td class="right">${s.vat > 0 ? manW(s.vat) : "-"}</td>
        <td class="right bold">${manW(s.total)}</td>
        <td class="center sched-due">${esc(dueLabel)}</td>
      </tr>`;
    }).join("");

    // 부가세 표기
    const vatDisplay = c.vatMode === "별도"
      ? `${c.vatRate}%`
      : (c.vatMode === "포함" ? "포함" : "해당없음");
    const vatAmtDisplay = c.vatMode === "별도" ? manW(c.vatAmt) : c.vatMode;

    root.innerHTML = `
<!-- ═══ 헤더 ═══ -->
<div class="est-doc-header">
  <div class="est-doc-header-inner">
    <div class="est-doc-badge">하이탑부동산</div>
    <div class="est-doc-title">${esc(headTitle)}</div>
  </div>
  <div class="est-doc-meta">
    <div class="est-doc-date">출력일: ${dateStr}</div>
    <div class="est-doc-phone">☎ 031-949-8969</div>
  </div>
</div>
<div class="est-doc-divider"></div>

${plan.url ? `
<div class="est-figure">
  <img src="${escAttr(plan.url)}" alt="도면">
  <div class="est-caption">${esc(plan.caption)}</div>
</div>` : ""}

<!-- ═══ ① 개요 ═══ -->
<div class="est-section">
  <div class="est-section-bar">◆ 개요</div>
  <table class="est-table est-overview">
    <tbody>
      <tr>
        <th class="ov-th-wide">주&nbsp;&nbsp;&nbsp;&nbsp;소</th>
        <td class="ov-td-addr">${esc(x.address || "-")}</td>
        <th class="ov-th-sm">호&nbsp;&nbsp;&nbsp;실</th>
        <td class="ov-td-ho highlight-gold bold">${esc(unitPart || "-")}</td>
      </tr>
      <tr>
        <th>전용면적</th>
        <td>${esc(exArea)}</td>
        <th>분양면적</th>
        <td>${esc(supArea)}</td>
      </tr>
      <tr>
        <th>분&nbsp;&nbsp;양&nbsp;&nbsp;가</th>
        <td class="highlight-gold bold">${manW(c.basePrice)}</td>
        <th>부가세(건물분) <span class="vat-rate-label">${vatDisplay}</span></th>
        <td>${vatAmtDisplay}</td>
      </tr>
      <tr>
        <th>총&nbsp;&nbsp;분&nbsp;&nbsp;양&nbsp;&nbsp;가</th>
        <td class="highlight-gold bold">${manW(c.totalPrice)}</td>
        <th>평&nbsp;&nbsp;당&nbsp;&nbsp;가</th>
        <td class="bold">
          ${c.pricePerPy !== null
            ? `${Math.round(c.pricePerPy).toLocaleString("ko-KR")}원`
              + (c.supplyPy > 0 ? `<span class="est-note-inline"> (분양 ${c.supplyPy}평 기준)</span>` : "")
            : "-"}
        </td>
      </tr>
    </tbody>
  </table>
</div>

<!-- ═══ ② 자금 및 납입일정 ═══ -->
<div class="est-section">
  <div class="est-section-bar">◆ 자금 및 납입일정 <span class="est-unit-label">[단위: 원]</span></div>
  <table class="est-table est-schedule">
    <thead>
      <tr>
        <th class="sched-th-label">구&nbsp;분</th>
        <th class="right sched-th-pct">비&nbsp;율</th>
        <th class="right">분&nbsp;양&nbsp;가</th>
        <th class="right">부&nbsp;가&nbsp;세</th>
        <th class="right">합&nbsp;&nbsp;&nbsp;계</th>
        <th class="center sched-th-due">납&nbsp;부&nbsp;시&nbsp;기</th>
      </tr>
    </thead>
    <tbody>
      ${schedRows}
    </tbody>
    <tfoot>
      <tr class="foot-total">
        <td class="sched-label">합&nbsp;&nbsp;&nbsp;계</td>
        <td class="right">100%</td>
        <td class="right">${manW(c.basePrice)}</td>
        <td class="right">${c.vatAmt > 0 ? manW(c.vatAmt) : "-"}</td>
        <td class="right bold">${manW(c.totalPrice)}</td>
        <td></td>
      </tr>
    </tfoot>
  </table>
</div>

<!-- ═══ ③ 기타비용 ═══ -->
<div class="est-section">
  <div class="est-section-bar">◆ 기타비용</div>
  <table class="est-table est-etc">
    <tbody>
      <tr>
        <th>취득세(분양가 ${c.acqTaxRate.toFixed(1)}%) 및 등기비용</th>
        <td class="right bold">${c.regRate > 0 ? (c.acqTaxRate + c.regRate).toFixed(1) + "%" : c.acqTaxRate.toFixed(1) + "%"}</td>
        <td class="right bold">${manW(c.etcTotal)}</td>
      </tr>
    </tbody>
  </table>
  <div class="est-note">※ VAT 제외 순분양가 기준. 취득세율은 건물 용도·면적에 따라 달라질 수 있습니다.</div>
</div>

<!-- ═══ ④ 대출 ═══ -->
<div class="est-section">
  <div class="est-section-bar">◆ 대출</div>
  <table class="est-table est-loan">
    <tbody>
      <tr>
        <th>대&nbsp;출&nbsp;액 &nbsp;${c.ltvPct.toFixed(0)}%</th>
        <td class="right bold highlight-gold">${c.loanAmt > 0 ? manW(c.loanAmt) : "미대출"}</td>
        <th>월&nbsp;&nbsp;이&nbsp;&nbsp;자 &nbsp;${c.intRate.toFixed(1)}%</th>
        <td class="right bold">${c.monthlyInt > 0 ? manW(c.monthlyInt) : "-"}</td>
      </tr>
    </tbody>
  </table>
  <div class="est-note">※ 대출 기준: VAT 제외 순분양가 × ${c.ltvPct.toFixed(0)}%</div>
</div>

<!-- ═══ ⑤ 임대(예상) ═══ -->
<div class="est-section">
  <div class="est-section-bar">◆ 임대(예상) <span class="est-unit-label">[VAT별도]</span></div>
  <table class="est-table est-rent">
    <tbody>
      <tr>
        <th>보&nbsp;&nbsp;증&nbsp;&nbsp;금</th>
        <td class="right highlight-gold bold">${man0W(c.deposit)}</td>
        <th>월&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;세</th>
        <td class="right highlight-gold bold">${c.monthlyRent > 0 ? manW(c.monthlyRent) : "-"}</td>
      </tr>
    </tbody>
  </table>
</div>

<!-- ═══ ⑥ 투자금 & 수익률 ═══ -->
<div class="est-section">
  <div class="est-section-bar">◆ 투자금 &amp; 수익률 <span class="est-unit-label">[VAT, 기타비용 미포함]</span></div>
  <table class="est-compare-table">
    <thead>
      <tr>
        <th class="cmp-th-label"></th>
        <th class="center cmp-th-col">대출시투자자금<br><span class="cmp-sub">(분양가−대출금−보증금)</span></th>
        <th class="center cmp-th-col">미대출시<br><span class="cmp-sub">(분양가−보증금)</span></th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <th>투 자 금 액</th>
        <td class="right highlight-gold bold">${manW(c.investWithLoan)}</td>
        <td class="right bold">${manW(c.investWithoutLoan)}</td>
      </tr>
      <tr class="yield-row-highlight">
        <th>수&nbsp;&nbsp;익&nbsp;&nbsp;률</th>
        <td class="right big-yield">${esc(c.ltvPct > 0 ? fmtPct(c.yieldWithLoan) : "-")}</td>
        <td class="right big-yield">${esc(fmtPct(c.yieldWithoutLoan))}</td>
      </tr>
    </tbody>
  </table>
  <div class="est-note">
    ※ 수익률(대출시) = (월세 − 월이자) × 12 ÷ 투자금 × 100<br>
    ※ 수익률(미대출시) = 월세 × 12 ÷ 투자금 × 100 &nbsp;|&nbsp; 관리비 미포함
  </div>
</div>

<!-- ═══ 푸터 ═══ -->
<div class="est-doc-footer">
  <div class="est-footer-main">하이탑부동산 &nbsp;|&nbsp; ☎ 031-949-8969 &nbsp;|&nbsp; 경기도 파주시</div>
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
    if (document.getElementById("estimateCssV4")) return;
    const s = document.createElement("style");
    s.id = "estimateCssV4";
    s.textContent = `
/* ══════════════════════════════════════
   HITOP 견적서 v4 — 실물 견적서 스타일
   ══════════════════════════════════════ */

#estimatePrint {
  font-family: "Malgun Gothic", "맑은 고딕", "Apple SD Gothic Neo", sans-serif;
  font-size: 9.5pt;
  color: #111;
  line-height: 1.45;
  max-width: 750px;
  margin: 0 auto;
  padding: 18pt 20pt;
  background: #fff;
}

/* ── 문서 헤더 ── */
.est-doc-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 4pt;
}
.est-doc-badge {
  display: inline-block;
  background: #1c3d6e;
  color: #fff;
  font-size: 8pt;
  padding: 2pt 9pt;
  border-radius: 2pt;
  margin-bottom: 4pt;
  letter-spacing: 0.5px;
}
.est-doc-title {
  font-size: 15pt;
  font-weight: 800;
  letter-spacing: -0.3px;
  color: #111;
}
.est-doc-meta {
  text-align: right;
  font-size: 8.5pt;
  color: #444;
  line-height: 1.8;
}
.est-doc-phone { font-weight: 700; color: #1c3d6e; }
.est-doc-divider {
  height: 2pt;
  background: linear-gradient(to right, #1c3d6e, #4a7fc1, #1c3d6e);
  margin-bottom: 10pt;
  border: none;
}

/* ── 섹션 ── */
.est-section { margin-bottom: 8pt; page-break-inside: avoid; }
.est-section-bar {
  font-size: 9.5pt;
  font-weight: 700;
  background: #1c3d6e;
  color: #fff;
  border-left: none;
  padding: 3.5pt 9pt;
  margin-bottom: 0;
  letter-spacing: 0.3px;
}
.est-unit-label { font-size: 8pt; font-weight: 400; opacity: 0.85; }
.est-note-inline { font-size: 7.5pt; color: #888; }
.vat-rate-label { font-size: 8pt; font-weight: 400; }

/* ── 공통 테이블 ── */
.est-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 9pt;
  border: 1.5px solid #2c4e8a;
}
.est-table th {
  background: #e8eef8;
  font-weight: 600;
  padding: 4pt 7pt;
  border: 1px solid #b0bdd4;
  color: #1a2d4e;
  white-space: nowrap;
}
.est-table td {
  padding: 4pt 7pt;
  border: 1px solid #c8d0e0;
  text-align: right;
}
.est-table .bold   { font-weight: 700; }
.est-table .right  { text-align: right; }
.est-table .center { text-align: center; }
.est-table .highlight-gold {
  background: #fff3b0;
  font-weight: 700;
}

/* ── 개요 테이블 ── */
.est-overview .ov-th-wide { width: 13%; text-align: center; }
.est-overview .ov-th-sm   { width: 10%; text-align: center; }
.est-overview .ov-td-addr { text-align: left; padding-left: 8pt; }
.est-overview .ov-td-ho   { text-align: center; font-size: 12pt; }

/* ── 납입일정 테이블 ── */
.est-schedule thead th {
  background: #2c4e8a;
  color: #fff;
  text-align: right;
  border-color: #3a5f9a;
}
.est-schedule thead .sched-th-label { text-align: left; width: 18%; }
.est-schedule thead .sched-th-pct   { width: 8%; }
.est-schedule thead .sched-th-due   { width: 20%; }
.est-schedule .sched-label          { text-align: left; font-weight: 600; }
.est-schedule .sched-due            { font-size: 8pt; color: #333; }
.est-schedule tfoot .foot-total td  { background: #dde3f0; font-weight: 700; border-color: #b0bdd4; }
.est-schedule tfoot .foot-total .sched-label { text-align: left; }

/* ── 기타비용 ── */
.est-etc th { width: 60%; text-align: left; padding-left: 9pt; }

/* ── 대출 ── */
.est-loan th { text-align: center; width: 22%; }

/* ── 임대 ── */
.est-rent th { text-align: center; width: 22%; }

/* ── 비교 테이블 ── */
.est-compare-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 9.5pt;
  border: 1.5px solid #2c4e8a;
}
.est-compare-table th, .est-compare-table td {
  border: 1px solid #b0bdd4;
  padding: 4.5pt 8pt;
}
.est-compare-table thead th {
  background: #2c4e8a;
  color: #fff;
  text-align: center;
  border-color: #3a5f9a;
}
.est-compare-table .cmp-th-label { width: 32%; background: #2c4e8a; }
.est-compare-table .cmp-th-col   { width: 34%; }
.est-compare-table .cmp-sub      { font-size: 7.5pt; font-weight: 400; opacity: 0.85; }
.est-compare-table tbody th {
  background: #e8eef8;
  text-align: left;
  font-weight: 600;
  color: #1a2d4e;
}
.est-compare-table .right         { text-align: right; }
.est-compare-table .center        { text-align: center; }
.est-compare-table .highlight-gold{ background: #fff3b0; }
.est-compare-table .bold          { font-weight: 700; }
.est-compare-table .yield-row-highlight th,
.est-compare-table .yield-row-highlight td {
  background: #dceeff;
  font-weight: 700;
}
.est-compare-table .big-yield {
  font-size: 14pt;
  font-weight: 900;
  color: #1864ab;
  text-align: right;
}

/* ── 도면 ── */
.est-figure { text-align: center; margin-bottom: 8pt; }
.est-figure img { max-width: 100%; max-height: 160pt; }
.est-caption { font-size: 8pt; color: #555; margin-top: 3pt; }

/* ── 노트 ── */
.est-note {
  font-size: 7.5pt;
  color: #555;
  margin-top: 3pt;
  line-height: 1.7;
  padding-left: 2pt;
}

/* ── 입력폼 (화면 전용) ── */
.est-form-box {
  border: 2px solid #1c3d6e;
  border-radius: 8px;
  padding: 16px;
  margin-top: 18px;
  background: #f7f9ff;
}
.est-form-title { font-weight: 700; font-size: 11pt; margin-bottom: 12px; color: #1c3d6e; }
.est-form-section-label { font-size: 9.5pt; font-weight: 700; color: #333; margin-bottom: 6px; }
.est-form-grid { display: grid; grid-template-columns: repeat(2,1fr); gap: 10px 24px; }
.ef-group label { display: block; font-size: 9pt; color: #444; margin-bottom: 3px; }
.ef-group input  {
  width: 100%; box-sizing: border-box;
  border: 1px solid #ced4da; border-radius: 4px;
  padding: 5px 8px; font-size: 10pt;
}
.est-form-actions { margin-top: 14px; display: flex; gap: 8px; justify-content: flex-end; }
.btn.primary {
  background: #1c3d6e; color: #fff; border: none;
  padding: 6px 18px; border-radius: 4px; cursor: pointer; font-size: 10pt;
}
.btn { background: #fff; border: 1px solid #1c3d6e; color: #1c3d6e;
  padding: 6px 18px; border-radius: 4px; cursor: pointer; font-size: 10pt;
}

/* ── 푸터 ── */
.est-doc-footer {
  border-top: 2pt solid #1c3d6e;
  padding-top: 5pt;
  margin-top: 10pt;
  display: flex;
  justify-content: space-between;
  font-size: 8.5pt;
}
.est-footer-main { font-weight: 700; color: #1c3d6e; }
.est-footer-note { color: #888; }

/* ── 인쇄 ── */
@media print {
  body { background: #fff !important; }
  .topbar, .page > .grid, .toast, .est-form-box,
  .btn, .card, #estimateFormWrap { display: none !important; }

  #estimatePrint { display: block !important; padding: 10mm 12mm; }

  .est-doc-divider,
  .est-section-bar,
  .est-schedule thead th,
  .est-compare-table thead th,
  .est-doc-badge {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .highlight-gold {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .est-compare-table .yield-row-highlight th,
  .est-compare-table .yield-row-highlight td {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  table, tr, td, th { page-break-inside: avoid; }
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
