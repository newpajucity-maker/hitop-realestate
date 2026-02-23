// assets/js/buildings.js
(function () {
  "use strict";

  const LS_KEY = "buildings";
  const FLOOR_PRESETS = ["B3","B2","B1","1F","2F","3F","4F","5F","6F","7F","8F","9F","10F","11F","12F","13F","14F","15F"];

  // [N-3] URL 안전성 검증
  function safeUrl(u) {
    if (!u || typeof u !== "string") return "";
    try {
      const url = new URL(u.trim());
      return (url.protocol === "https:" || url.protocol === "http:") ? u.trim() : "";
    } catch { return ""; }
  }

  let currentType   = "shop";
  let currentFilter = "all";
  let editId        = null;

  const $ = (id) => document.getElementById(id);

  const elTabs      = $("typeTabs");
  const elTypeExtra = $("typeExtra");
  const elFormTitle = $("formTitle");
  const elName      = $("b_name");
  const elAddr      = $("b_address");
  const elApproved  = $("b_approved");
  const elScaleB    = $("b_scale_b");
  const elScaleG    = $("b_scale_g");
  const elParking   = $("b_parking");
  const elList      = $("buildingList");
  const elEmpty     = $("empty");
  const elSearch    = $("searchInput");
  const elToast     = $("toast");
  const elPager     = $("pager");
  const elPageInfo  = $("pageInfo");
  const elBtnPrev   = $("btnPrevPage");
  const elBtnNext   = $("btnNextPage");

  const PAGE_SIZE = 8;
  let currentPage = 1;
  let pagedArr    = [];  // 현재 탭 전체 정렬된 배열

  // 페이지 렌더
  function renderPage(page) {
    currentPage = page;
    const total = pagedArr.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (currentPage < 1) currentPage = 1;
    if (currentPage > totalPages) currentPage = totalPages;

    const start = (currentPage - 1) * PAGE_SIZE;
    const slice = pagedArr.slice(start, start + PAGE_SIZE);

    elList.innerHTML = "";
    elEmpty.style.display = total ? "none" : "block";

    slice.forEach(item => {
      const div = document.createElement("div"); div.className = "item";
      const left = document.createElement("div"); left.className = "meta";
      const nameDiv = document.createElement("div"); nameDiv.className = "name"; nameDiv.textContent = item.name;
      const subDiv  = document.createElement("div"); subDiv.className  = "sub";  subDiv.textContent  = item.address || "(주소 미입력)";
      left.appendChild(nameDiv); left.appendChild(subDiv);
      const right   = document.createElement("div"); right.className = "item-actions";
      const editBtn = document.createElement("button"); editBtn.className = "btn mini"; editBtn.textContent = "수정";
      editBtn.onclick = () => loadToForm(item.id);
      const delBtn  = document.createElement("button"); delBtn.className  = "btn mini danger"; delBtn.textContent  = "삭제";
      delBtn.onclick = () => deleteBuilding(item.id);
      right.appendChild(editBtn); right.appendChild(delBtn);
      div.appendChild(left); div.appendChild(right);
      elList.appendChild(div);
    });

    // 페이저 표시
    if (elPager) elPager.style.display = totalPages > 1 ? "flex" : "none";
    if (elPageInfo) elPageInfo.textContent = `${currentPage} / ${totalPages}`;
    if (elBtnPrev) elBtnPrev.disabled = currentPage <= 1;
    if (elBtnNext) elBtnNext.disabled = currentPage >= totalPages;
  }

  // 페이저 버튼
  if (elBtnPrev) elBtnPrev.addEventListener("click", () => renderPage(currentPage - 1));
  if (elBtnNext) elBtnNext.addEventListener("click", () => renderPage(currentPage + 1));

  function toast(msg) {
    elToast.textContent = msg;
    elToast.classList.add("show");
    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(() => elToast.classList.remove("show"), 1600);
  }

  async function getBuildings() { return await StorageUtil.getArray(LS_KEY); }
  async function setBuildings(arr) { await StorageUtil.setArray(LS_KEY, arr); }

  function typeLabel(t) {
    if (t === "shop") return "상가"; if (t === "officetel") return "오피스텔";
    if (t === "apartment") return "아파트"; if (t === "bizcenter") return "지산";
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
        </div>`;
      elTypeExtra.appendChild(wrap);
      const fpList = document.getElementById("fpList");
      const btnAdd = document.getElementById("btnAddFloorplan");
      const existing = normalizeFloorplans(data);
      if (existing.length) existing.forEach(e => addFloorplanRow(fpList, e.floor, e.url));
      else addFloorplanRow(fpList, "1F", "");
      btnAdd.onclick = () => addFloorplanRow(fpList, "", "");
      if (data) {
        $("shop_summary").value = data.shop_summary || "";
        $("shop_office").value  = data.shop_office  || "";
        $("shop_note").value    = data.shop_note    || "";
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
        </div>`;
      elTypeExtra.appendChild(wrap);
      if (data) {
        const lays = data.layouts || [];
        $("lay1").value = lays[0] || ""; $("lay2").value = lays[1] || ""; $("lay3").value = lays[2] || "";
      }
    }
  }

  async function saveBuilding() {
    const name = normalizeName(elName.value);
    if (!name) { toast("건물명은 필수입니다."); return; }

    const scaleB    = toInt(elScaleB?.value);
    const scaleG    = toInt(elScaleG?.value);
    const scaleText = makeScaleText(scaleB, scaleG);

    const base = {
      id:       editId || StorageUtil.uid("b"),
      type:     currentType, name,
      address:  elAddr.value.trim(),
      approved: elApproved.value,
      scaleB, scaleG, scale: scaleText,
      parking:  elParking.value.trim(),
      updatedAt: new Date().toISOString(),
    };

    let extra = {};
    if (currentType === "shop") {
      const fpList = document.getElementById("fpList");
      const floorplansArr = collectFloorplans(fpList);
      const floorplans = {};
      // [N-3] safeUrl 검증 후 저장
      floorplansArr.forEach(e => {
        const cleanUrl = safeUrl(e.url);
        if (e.floor && cleanUrl) floorplans[e.floor] = cleanUrl;
      });
      extra = {
        shop_summary: $("shop_summary").value.trim(),
        shop_office:  $("shop_office").value.trim(),
        shop_note:    $("shop_note").value.trim(),
        floorplans, floorplansArr,
      };
    }
    if (currentType === "officetel") {
      extra = { layouts: [$("lay1").value.trim(), $("lay2").value.trim(), $("lay3").value.trim()].filter(Boolean) };
    }

    const record = { ...base, ...extra };

    // [BUG FIX] getBuildings 로그
    let arr;
    try {
      arr = await getBuildings();
      console.log("[saveBuilding] getBuildings 결과:", arr.length, "건", arr);
    } catch (e) {
      console.error("[saveBuilding] getBuildings 실패:", e);
      toast("저장 실패 - 데이터 읽기 오류");
      return;
    }

    let next;
    if (editId) {
      next = arr.map(x => (x.id === editId ? record : x));
    } else {
      record.createdAt = new Date().toISOString();
      next = [record, ...arr];
    }
    console.log("[saveBuilding] 저장할 배열:", next.length, "건", next);

    // [BUG FIX] setBuildings try/catch - 실패해도 renderList는 반드시 실행
    let saveOk = false;
    try {
      await setBuildings(next);
      saveOk = true;
      console.log("[saveBuilding] setBuildings 완료");
    } catch (e) {
      console.error("[saveBuilding] setBuildings 실패:", e);
      toast("저장 실패 ❌");
    }

    if (saveOk) {
      toast(editId ? "수정 완료 ✅" : "등록 완료 ✅");
      clearForm();
    }

    // [BUG FIX] 저장 성공/실패와 무관하게 renderList 실행 (보호 코드)
    try {
      await renderList(true);
    } catch (e) {
      console.error("[saveBuilding] renderList 실패:", e);
    }
  }

  function clearForm() {
    editId = null;
    elName.value = ""; elAddr.value = ""; elApproved.value = "";
    if (elScaleB) elScaleB.value = ""; if (elScaleG) elScaleG.value = "";
    elParking.value = "";
    renderTypeExtra(currentType, null);
  }

  async function loadToForm(id) {
    const arr  = await getBuildings();
    const item = arr.find(x => x.id === id); if (!item) return;
    editId      = item.id;
    currentType = item.type;
    Array.from(elTabs.querySelectorAll(".tab")).forEach(b => b.classList.toggle("active", b.dataset.type === currentType));
    elName.value = item.name || ""; elAddr.value = item.address || "";
    elApproved.value = item.approved || "";
    const parsed = parseScale(item);
    if (elScaleB) elScaleB.value = parsed.scaleB ?? ""; if (elScaleG) elScaleG.value = parsed.scaleG ?? "";
    elParking.value = item.parking || "";
    renderTypeExtra(currentType, item);
  }

  function addFloorplanRow(wrap, floor, url) {
    const row = document.createElement("div"); row.className = "attach-item";
    const presetOptions = FLOOR_PRESETS.map(f => `<option value="${f}">${f}</option>`).join("");
    row.innerHTML = `
      <input class="fp-floor" list="floorPresets" placeholder="층(예: 1F, B1)" value="${escAttr(floor)}"/>
      <input class="fp-url" placeholder="URL" value="${escAttr(url)}"/>
      <button class="btn danger" type="button">삭제</button>`;
    row.querySelector("button").onclick = () => row.remove();
    wrap.appendChild(row);
    if (!document.getElementById("floorPresets")) {
      const dl = document.createElement("datalist"); dl.id = "floorPresets";
      dl.innerHTML = presetOptions; document.body.appendChild(dl);
    }
  }

  function collectFloorplans(wrap) {
    const arr = []; if (!wrap) return arr;
    wrap.querySelectorAll(".attach-item").forEach(row => {
      const floor = (row.querySelector(".fp-floor")?.value || "").trim();
      const url   = (row.querySelector(".fp-url")?.value   || "").trim();
      if (floor || url) arr.push({ floor, url });
    });
    return arr.filter(e => e.floor && e.url);
  }

  function normalizeFloorplans(data) {
    if (!data) return [];
    if (Array.isArray(data.floorplansArr) && data.floorplansArr.length) {
      return data.floorplansArr.map(e => ({ floor:(e.floor||"").trim(), url:(e.url||"").trim() })).filter(e=>e.floor&&e.url);
    }
    const obj = data.floorplans || {};
    return Object.keys(obj).map(k => ({ floor:k, url:String(obj[k]||"").trim() })).filter(e=>e.floor&&e.url);
  }

  function toInt(v) { const n = Number(String(v??"").trim()); return Number.isFinite(n) ? Math.max(0,Math.floor(n)) : 0; }
  function makeScaleText(b, g) { return `${Number(b)?`지하${b}층`:"지하0층"} / ${Number(g)?`지상${g}층`:"지상0층"}`; }

  function parseScale(item) {
    if (typeof item.scaleB === "number" || typeof item.scaleG === "number") return { scaleB: item.scaleB??0, scaleG: item.scaleG??0 };
    const s = String(item.scale || "");
    const mB = s.match(/지하\s*(\d+)\s*층/), mG = s.match(/지상\s*(\d+)\s*층/);
    return { scaleB: mB ? Number(mB[1]) : 0, scaleG: mG ? Number(mG[1]) : 0 };
  }

  function escAttr(s) {
    return String(s??"").replaceAll("&","&amp;").replaceAll('"',"&quot;").replaceAll("<","&lt;").replaceAll(">","&gt;");
  }

  async function deleteBuilding(id) {
    const arr = await getBuildings();
    await setBuildings(arr.filter(x => x.id !== id));
    if (editId === id) clearForm();
    await renderList();
    toast("삭제 완료");
  }

  async function renderList(keepPage = false) {
    let arr;
    try {
      arr = await getBuildings();
    } catch (e) {
      console.error("[renderList] getBuildings 실패:", e);
      arr = [];
    }

    const activeTab  = elTabs.querySelector(".tab.active");
    const activeType = activeTab ? activeTab.dataset.type : "shop";

    // 가나다순 정렬
    pagedArr = arr
      .filter(x => x.type === activeType)
      .sort((a, b) => (a.name || "").localeCompare((b.name || ""), "ko"));

    if (!keepPage) currentPage = 1;
    renderPage(currentPage);
  }

  // 탭 클릭
  if (elTabs) {
    elTabs.addEventListener("click", async (e) => {
      const btn = e.target.closest(".tab"); if (!btn) return;
      const t = btn.dataset.type; if (!t) return;
      currentType = t; editId = null;
      Array.from(elTabs.querySelectorAll(".tab")).forEach(b => b.classList.toggle("active", b.dataset.type === t));
      renderTypeExtra(currentType, null);
      await renderList();
    });
  }

  const btnSave = document.getElementById("btnSave");
  const btnNew  = document.getElementById("btnNew");
  if (btnSave) btnSave.addEventListener("click", saveBuilding);
  if (btnNew)  btnNew.addEventListener("click", () => { clearForm(); toast("새로작성"); });

  renderTypeExtra(currentType, null);
  renderList();
})();
