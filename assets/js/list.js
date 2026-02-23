// assets/js/list.js
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const elType             = $("fType");
  const elBuilding         = $("fBuilding");
  const elDeal             = $("fDeal");
  const elStatus           = $("fStatus");
  const elListedOnly       = $("fListedOnly");
  const elSearch           = $("fSearch");
  const elFloorGroup       = $("fFloorGroup");
  const elTableHead        = $("tableHead");
  const elTableBody        = $("tableBody");
  const elCount            = $("resultCount");
  const elBtnPrint         = $("btnPrint");
  const elBtnPrintSelected = $("btnPrintSelected");
  const elBtnPrintOne      = $("btnPrintOne");
  const elBtnNew           = $("btnNew");
  const elBtnBuildings     = $("btnBuildings");
  const elBtnHome          = $("btnHome");
  const elBtnCustomers     = $("btnCustomers");
  const elPrintTitle       = $("printTitle");
  const elPrintSub         = $("printSub");

  // ── 상태 ────────────────────────────────────────────────────────
  const state = {
    type: "shop", buildingId: "", dealType: "", status: "",
    floorGroup: "", listedOnly: true, q: "",
    selected: new Set(),
  };

  // ── 로딩 제어 ────────────────────────────────────────────────────
  // isLoading: render가 실행 중인지 여부 (중복 실행 방지)
  // pendingRender: 로딩 중에 render 요청이 또 들어오면 true → 완료 후 1회 재실행
  let isLoading     = false;
  let pendingRender = false;

  // ── 검색 디바운스 타이머 ─────────────────────────────────────────
  let searchTimer = null;

  // ── 로딩 오버레이 헬퍼 ──────────────────────────────────────────
  // index.html에 <div id="loadingOverlay"> 요소가 있으면 표시/숨김
  // 없어도 에러 없이 동작 (선택적 UI)
  function showLoading() {
    elTableBody.style.opacity = "0.35";
    elTableBody.style.pointerEvents = "none";
    elCount.textContent = "로딩 중…";
    const ov = $("loadingOverlay");
    if (ov) ov.style.display = "flex";
  }

  function hideLoading() {
    elTableBody.style.opacity = "";
    elTableBody.style.pointerEvents = "";
    const ov = $("loadingOverlay");
    if (ov) ov.style.display = "none";
  }

  // ── 필터 버튼 잠금 / 해제 (로딩 중 중복 조작 방지) ──────────────
  function lockFilters() {
    [elType, elBuilding, elDeal, elStatus, elListedOnly, elFloorGroup]
      .forEach(el => { if (el) el.disabled = true; });
  }
  function unlockFilters() {
    [elType, elBuilding, elDeal, elStatus, elListedOnly, elFloorGroup]
      .forEach(el => { if (el) el.disabled = false; });
  }

  // ── 핵심: 안전한 render 래퍼 ────────────────────────────────────
  // 동시에 여러 render()가 실행되지 않도록 직렬화
  async function safeRender() {
    if (isLoading) {
      // 이미 로딩 중이면 "한 번 더 실행해달라"는 플래그만 세움
      pendingRender = true;
      return;
    }
    isLoading = true;
    lockFilters();
    showLoading();
    try {
      await render();
    } finally {
      isLoading = false;
      hideLoading();
      unlockFilters();
      // 로딩 중 추가 요청이 있었으면 1회만 재실행
      if (pendingRender) {
        pendingRender = false;
        await safeRender();
      }
    }
  }

  // ── 초기화 ──────────────────────────────────────────────────────
  init();

  async function init() {
    elType.value = state.type;
    elListedOnly.checked = state.listedOnly;
    // fFloorGroup 초기값 state와 동기화 (브라우저 캐시로 인한 불일치 방지)
    if (elFloorGroup) elFloorGroup.value = state.floorGroup;

    // 유형 변경: 건물 옵션도 함께 갱신
    elType.addEventListener("change", async () => {
      state.type = elType.value;
      state.buildingId = "";
      state.selected.clear();
      await renderBuildingOptions();
      await safeRender();
    });

    elBuilding.addEventListener("change",   async () => { state.buildingId = elBuilding.value; await safeRender(); });
    elDeal.addEventListener("change",       async () => { state.dealType   = elDeal.value;     await safeRender(); });
    elStatus.addEventListener("change",     async () => { state.status     = elStatus.value;   await safeRender(); });
    elListedOnly.addEventListener("change", async () => { state.listedOnly = elListedOnly.checked; await safeRender(); });

    if (elFloorGroup) {
      elFloorGroup.addEventListener("change", async () => { state.floorGroup = elFloorGroup.value; await safeRender(); });
    }

    // 검색: 300ms 디바운스 (타이핑마다 서버 요청 방지)
    elSearch.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(async () => {
        state.q = (elSearch.value || "").trim().toLowerCase();
        await safeRender();
      }, 300);
    });

    // ── 출력 버튼 [N-2 null 체크 유지] ──────────────────────────
    if (elBtnPrint) {
      elBtnPrint.addEventListener("click", async () => {
        await printWithRows(await getFilteredRows());
      });
    }
    if (elBtnPrintSelected) {
      elBtnPrintSelected.addEventListener("click", async () => {
        const sel = Array.from(state.selected);
        if (!sel.length) return alert("선택된 매물이 없습니다.");
        const all  = await getFilteredRows();
        const rows = all.filter(x => state.selected.has(x.id));
        if (!rows.length) return alert("현재 조건에서 선택된 매물이 없습니다.");
        await printWithRows(rows);
      });
    }
    if (elBtnPrintOne) {
      elBtnPrintOne.addEventListener("click", () => {
        const sel = Array.from(state.selected);
        if (sel.length !== 1) return alert("단건 출력은 1개만 선택해주세요.");
        location.href = `detail.html?id=${sel[0]}`;
      });
    }

    if (elBtnNew)       elBtnNew.addEventListener("click",       () => (location.href = "register.html"));
    if (elBtnBuildings) elBtnBuildings.addEventListener("click", () => (location.href = "buildings.html"));
    if (elBtnHome)      elBtnHome.addEventListener("click",      () => (location.href = "home.html"));
    if (elBtnCustomers) elBtnCustomers.addEventListener("click", () => (location.href = "customers.html"));

    // 백업/복원/엑셀 내보내기는 backup.js에서 처리

    // ── 체크박스 개별 클릭 이벤트 (이벤트 위임) ─────────────────
    document.addEventListener("click", (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      if (t.classList.contains("row-check")) {
        e.stopPropagation();
        const id = t.getAttribute("data-id");
        if (!id) return;
        if (t.checked) state.selected.add(id); else state.selected.delete(id);
        if (elBtnPrintOne) elBtnPrintOne.disabled = state.selected.size !== 1;
        syncHeaderCheckAll();
      }
      if (t.id === "checkAll") e.stopPropagation();
    }, true);

    // ── 최초 렌더 ────────────────────────────────────────────────
    await renderBuildingOptions();
    await safeRender();
  }

  // ── 건물 필터 옵션 갱신 ─────────────────────────────────────────
  async function renderBuildingOptions() {
    const buildings = (await DataUtil.getBuildings()).filter(b => b.type === state.type);
    elBuilding.innerHTML = `<option value="">건물 전체</option>`;
    buildings.forEach(b => {
      const opt = document.createElement("option");
      opt.value = b.id; opt.textContent = b.name;
      elBuilding.appendChild(opt);
    });
    elBuilding.value = state.buildingId || "";
  }

  // ── 핵심 렌더 함수 ──────────────────────────────────────────────
  async function render() {
    const filtered = await getFilteredRows();
    renderColumns(state.type);
    renderRows(state.type, filtered);
    elCount.textContent = `${filtered.length}건`;
    await updatePrintHeader();
    if (elBtnPrintOne) elBtnPrintOne.disabled = state.selected.size !== 1;
    // [N-4] render 후 반드시 bindCheckAll 재호출
    bindCheckAll(filtered);
  }

  // ── 데이터 조회 + 필터 ──────────────────────────────────────────
  async function getFilteredRows() {
    const listings = await DataUtil.getListings();
    return listings.filter(matches);
  }

  function matches(x) {
    if (x.type !== state.type) return false;
    if (state.listedOnly && !x.isListed) return false;
    if (state.status     && x.status    !== state.status)    return false;
    if (state.dealType   && x.dealType  !== state.dealType)  return false;
    if (state.buildingId && x.buildingId !== state.buildingId) return false;
    if (state.floorGroup) {
      const fg = x.floorGroup || guessFloorGroup(x.floor);
      if (fg !== state.floorGroup) return false;
    }
    if (state.q) {
      const hay = [
        x.title, x.address, x.buildingName, x.unit, x.ho, x.dong,
        x.memo, x.currentBiz, x.landUseZone, x.landJimo,
        x.ownerName, x.ownerPhone, x.tenantName, x.tenantPhone,
      ].join(" ").toLowerCase();
      if (!hay.includes(state.q)) return false;
    }
    return true;
  }

  // ── 컬럼 헤더 렌더 ──────────────────────────────────────────────
  function renderColumns(type) {
    const cols = getColumns(type);
    elTableHead.innerHTML = "";
    const tr = document.createElement("tr");
    cols.forEach(c => {
      const th = document.createElement("th");
      if (c.headerHtml) th.innerHTML = c.headerHtml; else th.textContent = c.label;
      if (c.className) th.className = c.className;
      tr.appendChild(th);
    });
    elTableHead.appendChild(tr);
  }

  // ── 행 렌더 ─────────────────────────────────────────────────────
  function renderRows(type, rows) {
    const cols = getColumns(type);
    elTableBody.innerHTML = "";
    rows.forEach((x, idx) => {
      const tr = document.createElement("tr");
      tr.style.cursor = "pointer";
      tr.addEventListener("click", () => (location.href = `detail.html?id=${x.id}`));
      cols.forEach(c => {
        const td = document.createElement("td");
        if (c.className) td.className = c.className;
        td.innerHTML = c.render ? c.render(x, idx) : "";
        tr.appendChild(td);
      });
      elTableBody.appendChild(tr);
    });
    if (rows.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = cols.length; td.className = "muted";
      td.textContent = "조건에 맞는 매물이 없습니다.";
      tr.appendChild(td); elTableBody.appendChild(tr);
    }
  }

  // ── 컬럼 정의 ───────────────────────────────────────────────────
  function getColumns(type) {
    const m2py = (m2, py) => {
      const m2v = m2 ?? "", pyv = py ?? "";
      if (!m2v && !pyv) return "-";
      const mm = m2v ? `${fmtNum(m2v)}㎡` : "";
      const pp = pyv ? `${fmtNum(pyv)}평` : "";
      return `${mm}${mm && pp ? " " : ""}(${pp})`;
    };
    const priceShop = x => {
      if (x.dealType === "임대" || x.dealType === "월세")
        return `${fmtMan(x.depositManwon)}/${fmtMan(x.rentManwon)}`;
      if (x.dealType === "매매" || x.dealType === "분양")
        return fmtMan(x.salePriceManwon);
      return "-";
    };
    const priceOffi = x => {
      if (x.dealType === "전세")
        return fmtMan(x.jeonsePriceManwon);
      if (x.dealType === "월세" || x.dealType === "임대")
        return `${fmtMan(x.depositManwon)}/${fmtMan(x.rentManwon)}`;
      if (x.dealType === "매매" || x.dealType === "분양")
        return fmtMan(x.salePriceManwon);
      return "-";
    };
    const colSelect = {
      label: "선택",
      headerHtml: `<input type="checkbox" id="checkAll" title="전체선택" />`,
      className: "center",
      render: x => {
        const checked = state.selected.has(x.id) ? "checked" : "";
        return `<input type="checkbox" class="row-check" data-id="${escAttr(x.id)}" ${checked}/>`;
      },
    };

    if (type === "officetel") return [colSelect,
      { label:"번호",       className:"center", render:(_,i)=>String(i+1) },
      { label:"건물명",                         render:x=>esc(x.buildingName||"-") },
      { label:"동/호수",                        render:x=>esc(`${x.dong?x.dong+" ":""}${x.ho||"-"}`) },
      { label:"층수",       className:"center", render:x=>esc(x.floorGroup||guessFloorGroup(x.floor)||"-") },
      { label:"타입/방",    className:"center", render:x=>esc(`${x.otType||"-"}${x.rooms?" / "+x.rooms+"R":""}`) },
      { label:"전용(㎡/평)",                   render:x=>esc(m2py(x.areaExclusiveM2,x.areaExclusivePy)) },
      { label:"분양(㎡/평)",                   render:x=>esc(m2py(x.areaSupplyM2,x.areaSupplyPy)) },
      { label:"향",         className:"center", render:x=>esc(x.direction||"-") },
      { label:"거래",       className:"center", render:x=>esc(x.dealType||"-") },
      { label:"가격",       className:"right",  render:x=>esc(priceOffi(x)) },
      { label:"상태",       className:"center", render:x=>esc(x.status||"-") }];

    if (type === "apartment") return [colSelect,
      { label:"번호",       className:"center", render:(_,i)=>String(i+1) },
      { label:"건물명",                         render:x=>esc(x.buildingName||"-") },
      { label:"동/호수",                        render:x=>esc(`${x.dong?x.dong+" ":""}${x.ho||"-"}`) },
      { label:"층수",       className:"center", render:x=>esc(x.floorGroup||guessFloorGroup(x.floor)||"-") },
      { label:"전용(㎡/평)",                   render:x=>esc(m2py(x.areaExclusiveM2,x.areaExclusivePy)) },
      { label:"분양(㎡/평)",                   render:x=>esc(m2py(x.areaSupplyM2,x.areaSupplyPy)) },
      { label:"타입",       className:"center", render:x=>esc(x.aptType||"-") },
      { label:"향",         className:"center", render:x=>esc(x.direction||"-") },
      { label:"거래",       className:"center", render:x=>esc(x.dealType||"-") },
      { label:"가격",       className:"right",  render:x=>esc(priceOffi(x)) },
      { label:"상태",       className:"center", render:x=>esc(x.status||"-") }];

    if (type === "bizcenter") return [colSelect,
      { label:"번호",       className:"center", render:(_,i)=>String(i+1) },
      { label:"건물명",                         render:x=>esc(x.buildingName||"-") },
      { label:"호실",       className:"center", render:x=>esc(x.unit||"-") },
      { label:"층수",       className:"center", render:x=>esc(x.floorGroup||guessFloorGroup(x.floor)||"-") },
      { label:"전용(㎡/평)",                   render:x=>esc(m2py(x.areaExclusiveM2,x.areaExclusivePy)) },
      { label:"거래",       className:"center", render:x=>esc(x.dealType||"-") },
      { label:"가격",       className:"right",  render:x=>esc(priceShop(x)) },
      { label:"상태",       className:"center", render:x=>esc(x.status||"-") }];

    if (type === "shop") return [colSelect,
      { label:"번호",       className:"center", render:(_,i)=>String(i+1) },
      { label:"건물명",                         render:x=>esc(x.buildingName||"-") },
      { label:"호실",       className:"center", render:x=>esc(x.unit||"-") },
      { label:"층수",       className:"center", render:x=>esc(x.floorGroup||guessFloorGroup(x.floor)||"-") },
      { label:"전용(㎡/평)",                   render:x=>esc(m2py(x.areaExclusiveM2,x.areaExclusivePy)) },
      { label:"분양(㎡/평)",                   render:x=>esc(m2py(x.areaSupplyM2,x.areaSupplyPy)) },
      { label:"현업종",                         render:x=>esc(x.currentBiz||"-") },
      { label:"거래",       className:"center", render:x=>esc(x.dealType||"-") },
      { label:"임대조건/가격", className:"right", render:x=>esc(priceShop(x)) },
      { label:"상태",       className:"center", render:x=>esc(x.status||"-") }];

    if (type === "land_dev" || type === "land_single" || type === "land_general") return [colSelect,
      { label:"번호",       className:"center", render:(_,i)=>String(i+1) },
      { label:"소재지",                         render:x=>esc(x.address||"-") },
      { label:"면적(㎡/평)",                   render:x=>esc(m2py(x.landAreaM2,x.landAreaPy)) },
      { label:"지목",       className:"center", render:x=>esc(x.landJimo||"-") },
      { label:"용도지역",                       render:x=>esc(x.landUseZone||"-") },
      { label:"매매가",     className:"right",  render:x=>esc(fmtMan(x.salePriceManwon)) },
      { label:"평당가",     className:"right",  render:x=>esc(calcPyeongPrice(x.salePriceManwon,x.landAreaPy)) },
      { label:"상태",       className:"center", render:x=>esc(x.status||"-") }];

    if (type === "factory") return [colSelect,
      { label:"번호",       className:"center", render:(_,i)=>String(i+1) },
      { label:"소재지",                         render:x=>esc(x.address||"-") },
      { label:"대지(㎡/평)",                   render:x=>esc(m2py(x.landAreaM2,x.landAreaPy)) },
      { label:"건축(㎡/평)",                   render:x=>esc(m2py(x.buildingAreaM2,x.buildingAreaPy)) },
      { label:"층고",       className:"center", render:x=>esc(x.clearHeightM?`${x.clearHeightM}m`:"-") },
      { label:"거래",       className:"center", render:x=>esc(x.dealType||"-") },
      { label:"가격",       className:"right",  render:x=>esc(priceShop(x)) },
      { label:"상태",       className:"center", render:x=>esc(x.status||"-") }];

    return [colSelect,
      { label:"번호",       className:"center", render:(_,i)=>String(i+1) },
      { label:"제목",                           render:x=>esc(x.title||"-") },
      { label:"주소/건물",                      render:x=>esc(x.address||x.buildingName||"-") },
      { label:"거래",       className:"center", render:x=>esc(x.dealType||"-") },
      { label:"상태",       className:"center", render:x=>esc(x.status||"-") }];
  }

  // ── [N-4] 체크박스 전체선택 바인딩 ─────────────────────────────
  // render() 후 반드시 호출 → 체크 상태가 리렌더 후에도 유지됨
  function bindCheckAll(filteredRows) {
    const checkAll = document.getElementById("checkAll");
    if (!checkAll) return;
    const boxes = Array.from(document.querySelectorAll(".row-check"));
    const checkedCount = boxes.filter(b => b.checked).length;
    checkAll.checked       = boxes.length > 0 && checkedCount === boxes.length;
    checkAll.indeterminate = checkedCount > 0 && checkedCount < boxes.length;
    // 이전 핸들러 제거 후 재등록 (중복 방지)
    checkAll.onchange = null;
    checkAll.onchange = () => {
      boxes.forEach(b => {
        b.checked = checkAll.checked;
        const id = b.getAttribute("data-id"); if (!id) return;
        if (checkAll.checked) state.selected.add(id); else state.selected.delete(id);
      });
      if (elBtnPrintOne) elBtnPrintOne.disabled = state.selected.size !== 1;
      const newChecked = boxes.filter(b => b.checked).length;
      checkAll.checked       = boxes.length > 0 && newChecked === boxes.length;
      checkAll.indeterminate = newChecked > 0 && newChecked < boxes.length;
    };
  }

  function syncHeaderCheckAll() {
    const checkAll = document.getElementById("checkAll"); if (!checkAll) return;
    const boxes = Array.from(document.querySelectorAll(".row-check"));
    const checkedCount = boxes.filter(b => b.checked).length;
    checkAll.checked       = boxes.length > 0 && checkedCount === boxes.length;
    checkAll.indeterminate = checkedCount > 0 && checkedCount < boxes.length;
  }

  // ── [N-4] 인쇄 후 bindCheckAll 재호출 ──────────────────────────
  async function printWithRows(rows) {
    const original = await getFilteredRows();
    renderColumns(state.type);
    renderRows(state.type, rows);
    await updatePrintHeader();
    window.print();
    // 인쇄 후 원래 목록 복원 + 체크박스 상태 복원
    renderColumns(state.type);
    renderRows(state.type, original);
    await updatePrintHeader();
    bindCheckAll(original);
  }

  // ── 유틸 ────────────────────────────────────────────────────────
  function guessFloorGroup(floor) {
    const f = String(floor || "").toUpperCase();
    if (f === "1F" || f.includes("1F")) return "1층";
    if (f === "2F" || f.includes("2F")) return "2층";
    return "상층부";
  }

  function escAttr(s) {
    return String(s ?? "")
      .replaceAll("&","&amp;").replaceAll('"',"&quot;")
      .replaceAll("<","&lt;").replaceAll(">","&gt;");
  }

  async function updatePrintHeader() {
    const typeLabel = labelByType(state.type);
    const bName     = await getSelectedBuildingName();
    const title     = bName ? `${bName} ${typeLabel} 매물 리스트` : `${typeLabel} 매물 리스트`;
    elPrintTitle.textContent = title;
    const today   = new Date();
    const dateStr = `${today.getFullYear()}.${pad2(today.getMonth()+1)}.${pad2(today.getDate())}`;
    elPrintSub.textContent =
      `출력일: ${dateStr} · 조건: ${state.listedOnly?"✅매물나옴":"전체"}` +
      `${state.dealType?" · "+state.dealType:""}` +
      `${state.status?" · "+state.status:""}`;
  }

  async function getSelectedBuildingName() {
    const id = state.buildingId || elBuilding.value; if (!id) return "";
    const b  = await DataUtil.findBuildingById(id);
    return b?.name || "";
  }

  function labelByType(t) {
    const m = {
      shop:"상가", officetel:"오피스텔", apartment:"아파트",
      bizcenter:"지식산업센터", land_dev:"토지(시행부지)",
      land_single:"토지(단독주택)", land_general:"토지(일반)", factory:"공장/창고",
    };
    return m[t] || "매물";
  }

  function fmtMan(v) {
    const n = Number(v);
    if (!isFinite(n) || n === 0) return "-";
    return n.toLocaleString("ko-KR") + "만원";
  }
  function fmtNum(v) {
    const n = Number(v); if (!isFinite(n)) return String(v ?? "");
    return String(v).includes(".") ? n.toFixed(2).replace(/\.00$/, "") : n.toLocaleString("ko-KR");
  }
  function calcPyeongPrice(priceMan, areaPy) {
    const p = Number(priceMan), a = Number(areaPy);
    if (!isFinite(p) || !isFinite(a) || a <= 0) return "-";
    return Math.round(p / a).toLocaleString("ko-KR") + "만원/평";
  }
  function esc(s) {
    return String(s ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
  }
  function pad2(n) { return String(n).padStart(2, "0"); }

})();
