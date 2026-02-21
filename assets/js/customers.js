// assets/js/customers.js  (개편 v2 - 홈목록 / 등록 / 상세 3뷰 구조)
(function(){
  "use strict";

  const $ = (id) => document.getElementById(id);
  const KEY = "customers";

  // ── 뷰 요소 ──
  const viewHome     = $("viewHome");
  const viewRegister = $("viewRegister");
  const viewDetail   = $("viewDetail");

  // ── 상태 ──
  let currentId = "";

  // ── 초기화 ──
  $("btnGoHome").onclick      = () => location.href = "home.html";
  $("btnGoList").onclick      = () => location.href = "index.html";
  $("btnGoRegister").onclick  = () => showView("register");
  $("btnBackToHome").onclick  = () => showView("home");
  $("btnEmptyRegister").onclick = () => showView("register");

  $("btnCancelRegister").onclick = () => showView("home");
  $("btnSaveCustomer").onclick   = saveCustomer;

  $("btnEditCustomer").onclick   = enterEditMode;
  $("btnCancelEdit").onclick     = exitEditMode;
  $("btnSaveEdit").onclick       = saveEdit;
  $("btnDeleteCustomer").onclick = deleteCustomer;
  $("btnAddNote").onclick        = addNote;

  $("q").addEventListener("input", renderHomeList);

  $("nDate").value = today();

  showView("home");

  // ── 뷰 전환 ──
  function showView(view) {
    viewHome.style.display     = view === "home"     ? "block" : "none";
    viewRegister.style.display = view === "register" ? "block" : "none";
    viewDetail.style.display   = view === "detail"   ? "block" : "none";

    $("btnGoRegister").style.display  = view === "home" ? "inline-flex" : "none";
    $("btnBackToHome").style.display  = view !== "home" ? "inline-flex" : "none";

    const titles = {
      home:     ["고객관리", "등록일순 고객 목록"],
      register: ["고객 등록", "새 고객 정보 입력"],
      detail:   ["고객 상세", "고객 정보 및 상담 기록"],
    };
    $("pageTitle").textContent    = titles[view][0];
    $("pageSubtitle").textContent = titles[view][1];

    if (view === "home") {
      clearRegisterForm();
      renderHomeList();
    }
    if (view === "detail") {
      exitEditMode();
      renderDetail();
    }
  }

  // ── 데이터 ──
  function getArr() { return StorageUtil.getArray(KEY); }
  function setArr(a){ StorageUtil.setArray(KEY, a); }

  // ── 홈 목록 렌더 (등록일 기준 날짜 그룹) ──
  function renderHomeList() {
    const q = ($("q").value || "").trim().toLowerCase();
    let arr = getArr().slice().sort((a, b) =>
      String(b.createdAt).localeCompare(String(a.createdAt))
    );
    if (q) {
      arr = arr.filter(x =>
        [x.name, x.phone, x.role, x.tag, x.memo].join(" ").toLowerCase().includes(q)
      );
    }

    $("totalCount").textContent = arr.length;
    const wrap = $("customerList");
    wrap.innerHTML = "";
    $("listEmpty").style.display = arr.length ? "none" : "block";

    // 날짜별 그룹핑
    const groups = {};
    arr.forEach(c => {
      const dateKey = c.createdAt ? c.createdAt.slice(0, 10) : "날짜 없음";
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(c);
    });

    Object.keys(groups).sort((a, b) => b.localeCompare(a)).forEach(dateKey => {
      // 날짜 헤더
      const header = document.createElement("div");
      header.className = "date-header";
      header.textContent = formatDateLabel(dateKey);
      wrap.appendChild(header);

      // 고객 카드들
      groups[dateKey].forEach(c => {
        const card = document.createElement("div");
        card.className = "c-card";
        card.innerHTML = `
          <div class="c-card-left">
            <div class="c-role-badge">${esc(c.role || "-")}</div>
            <div class="c-name">${esc(c.name)}</div>
            <div class="c-phone">${esc(c.phone || "-")}</div>
          </div>
          <div class="c-card-right">
            ${c.tag ? `<div class="c-tag">${esc(c.tag)}</div>` : ""}
            ${c.memo ? `<div class="c-memo">${esc(c.memo)}</div>` : ""}
            <div class="c-note-count">${noteCountText(c)}</div>
          </div>
          <div class="c-arrow">›</div>
        `;
        card.onclick = () => { currentId = c.id; showView("detail"); };
        wrap.appendChild(card);
      });
    });
  }

  function noteCountText(c) {
    const cnt = Array.isArray(c.notes) ? c.notes.length : 0;
    return cnt ? `상담기록 ${cnt}건` : "";
  }

  function formatDateLabel(dateStr) {
    if (!dateStr || dateStr === "날짜 없음") return "날짜 없음";
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const da = d.getDate();
    const days = ["일","월","화","수","목","금","토"];
    return `${y}년 ${m}월 ${da}일 (${days[d.getDay()]})`;
  }

  // ── 고객 등록 ──
  function saveCustomer() {
    const name = ($("cName").value || "").trim();
    if (!name) return toast("이름을 입력해주세요.");

    const record = {
      id: StorageUtil.uid("c"),
      name,
      phone: ($("cPhone").value || "").trim(),
      role: $("cRole").value,
      tag: ($("cTag").value || "").trim(),
      memo: ($("cMemo").value || "").trim(),
      notes: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const arr = getArr();
    arr.unshift(record);
    setArr(arr);
    toast("저장 완료!");
    showView("home");
  }

  function clearRegisterForm() {
    ["cName","cPhone","cTag","cMemo"].forEach(id => { $(id).value = ""; });
    if ($("cRole")) $("cRole").selectedIndex = 0;
  }

  // ── 상세 렌더 ──
  function renderDetail() {
    const arr = getArr();
    const cur = arr.find(x => x.id === currentId);
    if (!cur) { showView("home"); return; }

    $("dHead").innerHTML = `
      <div class="readonly-row"><span class="rk">이름</span><span class="rv">${esc(cur.name)}</span></div>
      <div class="readonly-row"><span class="rk">구분</span><span class="rv">${esc(cur.role || "-")}</span></div>
      <div class="readonly-row"><span class="rk">연락처</span><span class="rv">${esc(cur.phone || "-")}</span></div>
      <div class="readonly-row"><span class="rk">키워드</span><span class="rv">${esc(cur.tag || "-")}</span></div>
      ${cur.memo ? `<div class="readonly-row"><span class="rk">메모</span><span class="rv">${esc(cur.memo)}</span></div>` : ""}
      <div class="readonly-row"><span class="rk">등록일</span><span class="rv">${esc((cur.createdAt||"").slice(0,10))}</span></div>
    `;

    const notes = Array.isArray(cur.notes)
      ? cur.notes.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)))
      : [];

    const elNotes = $("notes");
    elNotes.innerHTML = "";
    $("notesEmpty").style.display = notes.length ? "none" : "block";

    notes.forEach(n => {
      const div = document.createElement("div");
      div.className = "n-item";
      div.innerHTML = `
        <div class="n-top">
          <div class="n-date">${esc(n.date || "")}</div>
          <button class="btn mini danger" type="button">삭제</button>
        </div>
        <div class="n-text">${esc(n.text || "")}</div>
      `;
      div.querySelector("button").onclick = () => deleteNote(n.id);
      elNotes.appendChild(div);
    });
  }

  // ── 수정 모드 ──
  function enterEditMode() {
    const cur = getArr().find(x => x.id === currentId);
    if (!cur) return;
    $("eName").value  = cur.name  || "";
    $("ePhone").value = cur.phone || "";
    $("eTag").value   = cur.tag   || "";
    $("eMemo").value  = cur.memo  || "";
    const eRole = $("eRole");
    for (let i = 0; i < eRole.options.length; i++) {
      if (eRole.options[i].value === cur.role) { eRole.selectedIndex = i; break; }
    }
    $("detailReadMode").style.display = "none";
    $("detailEditMode").style.display = "block";
  }

  function exitEditMode() {
    $("detailReadMode").style.display = "block";
    $("detailEditMode").style.display = "none";
  }

  function saveEdit() {
    const name = ($("eName").value || "").trim();
    if (!name) return toast("이름을 입력해주세요.");
    const arr = getArr();
    const idx = arr.findIndex(x => x.id === currentId);
    if (idx < 0) return;
    arr[idx].name  = name;
    arr[idx].phone = ($("ePhone").value || "").trim();
    arr[idx].role  = $("eRole").value;
    arr[idx].tag   = ($("eTag").value || "").trim();
    arr[idx].memo  = ($("eMemo").value || "").trim();
    arr[idx].updatedAt = new Date().toISOString();
    setArr(arr);
    toast("수정 완료!");
    exitEditMode();
    renderDetail();
  }

  // ── 메모 추가/삭제 ──
  function addNote() {
    const d = $("nDate").value || today();
    const t = ($("nText").value || "").trim();
    if (!t) return toast("메모를 입력해주세요.");

    const arr = getArr();
    const idx = arr.findIndex(x => x.id === currentId);
    if (idx < 0) return;
    arr[idx].notes = Array.isArray(arr[idx].notes) ? arr[idx].notes : [];
    arr[idx].notes.unshift({ id: StorageUtil.uid("n"), date: d, text: t });
    arr[idx].updatedAt = new Date().toISOString();
    setArr(arr);
    $("nText").value = "";
    toast("추가 완료!");
    renderDetail();
  }

  function deleteNote(noteId) {
    const arr = getArr();
    const idx = arr.findIndex(x => x.id === currentId);
    if (idx < 0) return;
    arr[idx].notes = (arr[idx].notes || []).filter(n => n.id !== noteId);
    arr[idx].updatedAt = new Date().toISOString();
    setArr(arr);
    toast("삭제 완료");
    renderDetail();
  }

  function deleteCustomer() {
    if (!currentId) return;
    if (!confirm("이 고객을 삭제할까요?")) return;
    setArr(getArr().filter(x => x.id !== currentId));
    currentId = "";
    toast("삭제 완료");
    showView("home");
  }

  // ── 유틸 ──
  function today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }

  function toast(msg) {
    const el = $("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(window.__t);
    window.__t = setTimeout(() => el.classList.remove("show"), 1800);
  }

  function esc(s) {
    return String(s ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
  }

})();
