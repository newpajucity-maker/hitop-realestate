// assets/js/home.js
(async function(){
  "use strict";

  const $ = (id) => document.getElementById(id);
  const KEY = "scheduleEvents";

  const elDate  = $("evDate");
  const elTitle = $("evTitle");
  const elMemo  = $("evMemo");
  const elList  = $("evList");
  const elEmpty = $("evEmpty");
  const elToast = $("toast");

  $("goList").onclick      = () => location.href = "index.html";
  $("goRegister").onclick  = () => location.href = "register.html";
  $("goBuildings").onclick = () => location.href = "buildings.html";
  $("goCustomers").onclick = () => location.href = "customers.html";

  $("btnAdd").onclick   = add;
  $("btnClear").onclick = clearAll;

  elDate.value = today();

  await render();

  function toast(msg){
    elToast.textContent = msg;
    elToast.classList.add("show");
    clearTimeout(window.__t);
    window.__t = setTimeout(() => elToast.classList.remove("show"), 1500);
  }

  async function getArr(){ return await StorageUtil.getArray(KEY); }
  async function setArr(a){ await StorageUtil.setArray(KEY, a); }

  async function add(){
    const d = elDate.value || today();
    const t = (elTitle.value || "").trim();
    const m = (elMemo.value  || "").trim();
    if (!t) return toast("제목을 입력해주세요.");

    const arr = await getArr();
    arr.unshift({ id: StorageUtil.uid("e"), date:d, title:t, memo:m, createdAt: new Date().toISOString() });
    await setArr(arr);

    elTitle.value = "";
    elMemo.value  = "";
    toast("저장 완료");
    await render();
  }

  async function clearAll(){
    if (!confirm("일정을 전부 삭제할까요?")) return;
    await setArr([]);
    toast("삭제 완료");
    await render();
  }

  async function del(id){
    const arr = (await getArr()).filter(x => x.id !== id);
    await setArr(arr);
    toast("삭제 완료");
    await render();
  }

  async function render(){
    const arr = (await getArr()).slice().sort((a,b) => String(a.date).localeCompare(String(b.date)));
    elList.innerHTML = "";
    elEmpty.style.display = arr.length ? "none" : "block";

    arr.forEach(ev => {
      const div = document.createElement("div");
      div.className = "ev-item";
      div.innerHTML = `
        <div class="ev-top">
          <div>
            <div class="ev-date">${esc(ev.date)}</div>
            <div class="ev-title">${esc(ev.title)}</div>
          </div>
          <div class="ev-actions">
            <button class="btn mini danger" type="button">삭제</button>
          </div>
        </div>
        <div class="ev-memo">${esc(ev.memo || "")}</div>
      `;
      div.querySelector("button").onclick = () => del(ev.id);
      elList.appendChild(div);
    });
  }

  function today(){
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }

  function esc(s){
    return String(s ?? "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;");
  }
})();
