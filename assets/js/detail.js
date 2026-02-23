// assets/js/detail.js
(async function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const elTitle   = $("dTitle");
  const elSub     = $("dSub");
  const elMeta    = $("dMeta");
  const elInfo    = $("dInfo");
  const elPlanBox = $("dPlanBox");

  const btnBack      = $("btnBack");
  const btnEstimate  = $("btnEstimate");
  const btnEdit      = $("btnEdit");
  const elInfoPrint  = document.getElementById("infoPrint");

  const qs        = new URLSearchParams(location.search);
  const id        = qs.get("id");
  const printMode = qs.get("print");

  if (!id) { alert("잘못된 접근입니다. id가 없습니다."); location.href = "index.html"; return; }

  // 매물 조회
  const listings = await DataUtil.getListings();
  const listing  = listings.find(x => x.id === id);
  if (!listing) { alert("매물을 찾을 수 없습니다."); location.href = "index.html"; return; }

  btnBack.addEventListener("click", () => history.back());
  if (btnEstimate) {
    btnEstimate.addEventListener("click", () => {
      location.href = `estimate.html?id=${listing.id}`;
    });
  }
  btnEdit.addEventListener("click", () => { location.href = `register.html?id=${listing.id}`; });

  // 삭제 버튼
  const btnDelete = document.getElementById("btnDelete");
  if (btnDelete) {
    btnDelete.addEventListener("click", async () => {
      const label = listing.title || listing.buildingName || listing.address || "이 매물";
      if (!confirm(`[${label}] 매물을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
      await DataUtil.deleteListing(listing.id); // 단건 삭제 (전체 교체 없음)
      alert("삭제 완료");
      location.href = "index.html";
    });
  }

  const btnInfoPrintCustomer = $("btnInfoPrintCustomer");
  const btnInfoPrintData     = $("btnInfoPrintData");

  if (btnInfoPrintCustomer) {
    btnInfoPrintCustomer.addEventListener("click", async () => {
      await renderInfoPrint(listing, false);
      window.print();
    });
  }
  if (btnInfoPrintData) {
    btnInfoPrintData.addEventListener("click", async () => {
      await renderInfoPrint(listing, true);
      window.print();
    });
  }

  await renderDetail(listing);

  async function renderDetail(x) {
    elTitle.textContent = x.title || x.buildingName || "(제목 없음)";
    const head = [labelByType(x.type), x.buildingName || "", x.address || ""].filter(Boolean).join(" · ");
    elSub.textContent = head;

    elMeta.innerHTML = "";
    elMeta.appendChild(metaBox("거래유형", x.dealType || "-"));
    elMeta.appendChild(metaBox("상태",     x.status   || "-"));
    elMeta.appendChild(metaBox("매물나옴", x.isListed ? "✅" : "—"));
    elMeta.appendChild(metaBox("향",       x.direction || "—"));

    elInfo.innerHTML = "";
    addInfo("주소", x.address || "—");
    if (x.buildingName) addInfo("건물명", x.buildingName);
    if (x.unit) addInfo("호실", x.unit);
    if (x.ho)   addInfo("호수", x.ho);
    if (x.floorGroup) addInfo("층수", x.floorGroup);
    else if (x.floor) addInfo("층", x.floor);
    if (x.areaExclusiveM2 || x.areaExclusivePy) addInfo("전용면적", fmtArea(x.areaExclusiveM2, x.areaExclusivePy));
    if (x.areaSupplyM2    || x.areaSupplyPy)    addInfo("분양면적", fmtArea(x.areaSupplyM2, x.areaSupplyPy));
    if (x.landAreaM2      || x.landAreaPy)      addInfo("토지면적", fmtArea(x.landAreaM2, x.landAreaPy));
    if (x.buildingAreaM2  || x.buildingAreaPy)  addInfo("건축면적", fmtArea(x.buildingAreaM2, x.buildingAreaPy));

    const p = priceText(x);
    if (p) addInfo("가격", p);

    // 상가·지식산업센터·공장 매매 시 임대조건 항상 표시
    const isCommSale = (x.type === "shop" || x.type === "bizcenter" || x.type === "factory")
                    && (x.dealType === "매매" || x.dealType === "분양");
    if (isCommSale) {
      const man = n => (n && Number(n) ? Number(n).toLocaleString("ko-KR")+"만원" : "");
      const rc = [x.depositManwon ? "보증금 "+man(x.depositManwon) : "",
                  x.rentManwon    ? "월세 "+man(x.rentManwon)      : ""]
                 .filter(Boolean).join(" / ") || "미입력";
      addInfo("임대조건(보증금/월세)", rc);
    }

    if (x.ownerName)  addInfo("소유주",  `${x.ownerName}${x.ownerPhone?" ("+x.ownerPhone+")":""}`);
    if (x.tenantName) addInfo("임차인",  `${x.tenantName}${x.tenantPhone?" ("+x.tenantPhone+")":""}`);
    if (x.leaseEnd)   addInfo("계약만료", x.leaseEnd);
    if (Array.isArray(x.memoEntries) && x.memoEntries.length) {
      const t = x.memoEntries.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date)))
        .map(m => `${m.date||""}  ${m.text||""}`.trim()).join("\n");
      if (t) addInfo("메모", t);
    } else if (x.memo) { addInfo("메모", x.memo); }

    await renderPlan(x);
  }

  async function renderPlan(x) {
    elPlanBox.innerHTML = "";
    const b = x.buildingId ? await DataUtil.findBuildingById(x.buildingId) : null;

    if (x.type === "shop" && b?.floorplans) {
      const key = x.floor || (x.floorGroup === "1층" ? "1F" : x.floorGroup === "2층" ? "2F" : "3F");
      const url = b.floorplans[key];
      if (url) {
        elPlanBox.innerHTML = `<div class="image-box"><img src="${escapeAttr(url)}" alt="평면도"><div class="small" style="margin-top:8px;">${esc(key)} 평면도</div></div>`;
        return;
      }
    }
    if ((x.type === "officetel" || x.type === "apartment") && b?.layouts?.length) {
      elPlanBox.innerHTML = `<div class="image-box"><img src="${escapeAttr(b.layouts[0])}" alt="배치도"><div class="small" style="margin-top:8px;">호수 배치도</div></div>`;
      return;
    }
    if ((x.type.startsWith("land") || x.type === "factory") && Array.isArray(x.attachments) && x.attachments.length) {
      const box = document.createElement("div"); box.className = "readonly-box";
      x.attachments.forEach(a => {
        const div = document.createElement("div"); div.className = "small";
        const link = document.createElement("a");
        link.href = safeUrl(a.url); link.target = "_blank"; link.rel = "noopener noreferrer";
        link.textContent = a.label || "자료";
        div.append("- ", link); box.appendChild(div);
      });
      elPlanBox.appendChild(box); return;
    }
    elPlanBox.innerHTML = `<div class="small">등록된 도면/자료가 없습니다.</div>`;
  }

  function metaBox(label, value) {
    const div = document.createElement("div"); div.className = "box";
    div.innerHTML = `<div class="label">${esc(label)}</div><div class="value">${esc(value)}</div>`;
    return div;
  }

  function addInfo(k, v) {
    const row = document.createElement("div"); row.className = "info-row";
    row.innerHTML = `<div class="k">${esc(k)}</div><div class="v">${esc(v)}</div>`;
    elInfo.appendChild(row);
  }

  function fmtArea(m2, py) {
    const mm = (m2 && Number(m2) > 0) ? `${fmtNum(m2)}㎡` : "";
    const pp = (py && Number(py) > 0) ? `(${fmtNum(py)}평)` : "";
    return [mm, pp].filter(Boolean).join(" ") || "—";
  }

  function priceText(x) {
    const man = n => (n && Number(n) ? Number(n).toLocaleString("ko-KR")+"만원" : "");
    if (x.type === "shop" || x.type === "bizcenter" || x.type === "factory") {
      if (x.dealType === "임대" || x.dealType === "월세") return `보증금 ${man(x.depositManwon)} / 월세 ${man(x.rentManwon)}`;
      if (x.dealType === "매매" || x.dealType === "분양") return x.salePriceManwon ? `매매 ${man(x.salePriceManwon)}` : "";
    }
    if (x.type === "officetel" || x.type === "apartment") {
      if (x.dealType === "전세") return x.jeonsePriceManwon ? `전세 ${man(x.jeonsePriceManwon)}` : "";
      if (x.dealType === "월세" || x.dealType === "임대") return `보증금 ${man(x.depositManwon)} / 월세 ${man(x.rentManwon)}`;
      if (x.dealType === "매매" || x.dealType === "분양") return x.salePriceManwon ? `매매 ${man(x.salePriceManwon)}` : "";
    }
    if (x.type.startsWith("land")) return x.salePriceManwon ? `매매 ${man(x.salePriceManwon)}` : "";
    return "";
  }

  function labelByType(t) {
    const map = {shop:"상가",officetel:"오피스텔",apartment:"아파트",bizcenter:"지식산업센터",
      factory:"공장/창고",land_dev:"토지(시행)",land_single:"토지(단독)",land_general:"토지(일반)"};
    return map[t] || "매물";
  }

  function fmtNum(v) {
    const n = Number(v); if (!isFinite(n)) return String(v ?? "");
    return String(v).includes(".") ? n.toFixed(2).replace(/\.00$/, "") : n.toLocaleString("ko-KR");
  }
  function esc(s) { return String(s ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;"); }
  function safeUrl(u) {
    if (!u || typeof u !== "string") return "#";
    try { const url = new URL(u.trim()); return (url.protocol==="https:"||url.protocol==="http:") ? u.trim() : "#"; }
    catch { return "#"; }
  }
  function escapeAttr(s) {
    return String(s ?? "").replaceAll("&","&amp;").replaceAll('"',"&quot;").replaceAll("<","&lt;").replaceAll(">","&gt;");
  }

  async function renderInfoPrint(x, showContact) {
    if (!elInfoPrint) return;
    const b = x.buildingId ? await DataUtil.findBuildingById(x.buildingId) : null;

    const title    = x.title || [x.buildingName, x.unit||x.ho].filter(Boolean).join(" ") || "매물 설명";
    const unitTxt  = x.unit ? x.unit+"호" : (x.ho ? x.ho : "");
    const fullAddr = [x.address||"", x.unit?x.unit+"호":(x.ho?x.ho:"")].filter(Boolean).join(" ") || "-";
    const price    = priceText(x) || "-";
    const exArea   = fmtArea(x.areaExclusiveM2, x.areaExclusivePy);
    const supArea  = fmtArea(x.areaSupplyM2,    x.areaSupplyPy);
    const landArea = fmtArea(x.landAreaM2,       x.landAreaPy);
    const bldArea  = fmtArea(x.buildingAreaM2,   x.buildingAreaPy);

    const today   = new Date();
    const dateStr = `${today.getFullYear()}.${String(today.getMonth()+1).padStart(2,"0")}.${String(today.getDate()).padStart(2,"0")}`;

    const memoText = Array.isArray(x.memoEntries) && x.memoEntries.length
      ? x.memoEntries.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date)))
          .map(m=>(m.date?"["+m.date+"] ":"")+( m.text||"")).filter(Boolean).join("\n")
      : (x.memo || "");

    const approved = b ? (b.approved || "") : "";
    const parking  = b ? (b.parking  || "") : "";
    const mainFee  = x.maintenanceFeeManwon ? Number(x.maintenanceFeeManwon).toLocaleString("ko-KR")+"만원" : "";
    const areaForSummary    = exArea   !== "—" ? exArea   : (landArea !== "—" ? landArea : "-");
    const supAreaForSummary = supArea  !== "—" ? supArea  : (bldArea  !== "—" ? bldArea  : "");

    const man = n => (n && Number(n) ? Number(n).toLocaleString("ko-KR")+"만원" : "");

    // 상가·지식산업센터·공장 매매 시 임대조건 추출 (값 없으면 미입력 표시)
    const isCommercialSale = (x.type === "shop" || x.type === "bizcenter" || x.type === "factory")
                          && (x.dealType === "매매" || x.dealType === "분양");
    const rentCondition = isCommercialSale
      ? (x.depositManwon || x.rentManwon)
        ? [x.depositManwon ? "보증금 "+man(x.depositManwon) : "",
           x.rentManwon    ? "월세 "+man(x.rentManwon)      : ""]
          .filter(Boolean).join(" / ")
        : "미입력"
      : "";

    // 일반 행 / 강조 행 헬퍼
    const tr  = (k, v)      => `<tr><th>${esc(k)}</th><td>${esc(String(v??""))}</td></tr>`;
    const trH = (k, v, cls) => `<tr class="ip-highlight ${cls||""}"><th>${esc(k)}</th><td>${esc(String(v??""))}</td></tr>`;

    const trows = [];
    trows.push(tr("위치(주소)", fullAddr));
    if (x.buildingName)  trows.push(tr("건물명",        x.buildingName));
    if (exArea  !== "—") trows.push(tr("전용면적",       exArea));
    if (supArea !== "—") trows.push(tr("분양(계약)면적", supArea));
    if (landArea!== "—") trows.push(tr("토지면적",       landArea));
    if (bldArea !== "—") trows.push(tr("건축면적",       bldArea));
    if (x.direction)     trows.push(tr("향",             x.direction));
    if (x.currentBiz)    trows.push(trH("현업종",        x.currentBiz,  "ip-biz"));
    if (parking)         trows.push(tr("주차대수",        parking));
    if (approved)        trows.push(tr("사용승인일",      approved));
    if (x.otType)        trows.push(tr("타입",            x.otType));
    if (x.rooms)         trows.push(tr("방수",            x.rooms+"R"));
    if (x.leaseEnd)      trows.push(trH("계약만료일",     x.leaseEnd,    "ip-lease"));
    if (x.vatMode && x.vatMode !== "해당없음")
                         trows.push(tr("부가세",          x.vatMode+" "+(x.vatRate||10)+"%"));
    if (mainFee)         trows.push(tr("관리비",          mainFee));
    // ── 임대조건: 강조 행 ──
    if (rentCondition)   trows.push(trH("임대조건(보증금/월세)", rentCondition, "ip-rent"));
    if (x.landJimo)      trows.push(tr("지목",            x.landJimo));
    if (x.landUseZone)   trows.push(tr("용도지역",        x.landUseZone));
    if (x.coverageRatio) trows.push(tr("건폐율",          x.coverageRatio+"%"));
    if (x.farRatio)      trows.push(tr("용적률",          x.farRatio+"%"));
    if (x.roadAccess)    trows.push(tr("도로접합",        x.roadAccess));
    if (x.clearHeightM)  trows.push(tr("층고",            x.clearHeightM+"m"));
    if (x.powerKw)       trows.push(tr("전력",            x.powerKw+"kW"));
    if (showContact) {
      if (x.ownerName)   trows.push(trH("소유주",         x.ownerName,   "ip-contact"));
      if (x.ownerPhone)  trows.push(trH("소유주 연락처",  x.ownerPhone,  "ip-contact"));
      if (x.tenantName)  trows.push(trH("임차인",         x.tenantName,  "ip-contact"));
      if (x.tenantPhone) trows.push(trH("임차인 연락처",  x.tenantPhone, "ip-contact"));
    }

    const dc = x.descChecks || {};
    const descDefs = [
      {key:"location", title:"① 입지 분석",             txtKey:"locationText"},
      {key:"demand",   title:"② 수요 및 업종 적합성",   txtKey:"demandText"},
      {key:"strength", title:"③ 매물 강점",             txtKey:"strengthText"},
      {key:"notes",    title:"④ 계약 조건 및 유의사항", txtKey:"notesText"},
    ];
    const descHtml = descDefs
      .filter(d => dc[d.key] && (dc[d.txtKey]||"").trim())
      .map(d => `<div class="ip-desc-block"><div class="db-title">${d.title}</div><div class="db-content">${esc((dc[d.txtKey]||"").trim())}</div></div>`)
      .join("");

    // 핵심 요약 박스 - 임대조건 행 조건부 추가
    const rentSummaryRow = rentCondition
      ? `<tr class="ip-rent-row"><th>임 대 조 건</th><td colspan="3">${esc(rentCondition)}</td></tr>`
      : "";

    elInfoPrint.innerHTML = `
      <div class="ip-top-date">출력일: ${dateStr}${showContact?" [자료용]":" [고객용]"}</div>
      <div class="ip-doc-title">부동산 매물 설명서</div>

      <div class="ip-summary">
        <div class="ip-summary-title">◆ 핵심 요약</div>
        <table class="ip-sum-table">
          <tr>
            <th>건 물 명</th>
            <td colspan="3">
              <strong>${esc(x.buildingName||title)}</strong>
              ${unitTxt ? "&nbsp;&nbsp;<span class='ip-unit'>"+esc(unitTxt)+"</span>" : ""}
            </td>
          </tr>
          <tr>
            <th>거래형태</th><td>${esc(x.dealType||"-")}</td>
            <th>상&nbsp;&nbsp;&nbsp;&nbsp;태</th><td>${esc(x.status||"-")}</td>
          </tr>
          <tr>
            <th>전용면적</th><td>${esc(areaForSummary)}</td>
            <th>분양면적</th><td>${esc(supAreaForSummary||"-")}</td>
          </tr>
          <tr class="ip-price-row">
            <th>매 매 가 격</th>
            <td colspan="3">${esc(price)}</td>
          </tr>
          ${rentSummaryRow}
        </table>
      </div>

      <div class="ip-section-title">◆ 상세 정보</div>
      <table class="ip-table"><tbody>${trows.join("")}</tbody></table>

      ${descHtml ? '<div class="ip-section-title" style="margin-top:10pt;">◆ 매물 설명</div>'+descHtml : ""}
      ${memoText ? '<div class="ip-memo-block"><div class="db-title">메모 / 특이사항</div><div class="db-content">'+esc(memoText)+"</div></div>" : ""}
      <div class="ip-write-memo">
        <div class="ip-write-memo-title">메 &nbsp;&nbsp; 모</div>
        <div class="ip-write-memo-body"></div>
      </div>
      <div class="ip-footer">
        <div class="ip-footer-main">하이탑부동산 &nbsp;|&nbsp; ☎ 031-949-8969</div>
        <div class="ip-footer-note">본 설명서는 내부 참고용이며 공식 계약서가 아닙니다.</div>
      </div>`;
  }
})();
