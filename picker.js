/* ============================================================
   Masjid picker + data loading.
   - Shows the list/search screen when no masjid is chosen (or when the
     user taps the masjid name in the header).
   - Masjid data lives in masjids/*.json. The app fetches it fresh every
     time it opens and keeps a copy for offline use, so adding a masjid
     never needs an app update.
   ============================================================ */

(function () {
  const MASJID_KEY = "iqamahMasjid";          // id of the chosen masjid
  const CACHE_PREFIX = "iqamahData:";         // cached copies of the JSON files
  const REMOTE_BASE = "https://gufranmohammed48.github.io/Iqamatime/masjids/"; // live data for the phone apps
  const isNative = !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());

  const $p = (id) => document.getElementById(id);
  let masjidList = [];

  function readCache(name) {
    try { return JSON.parse(localStorage.getItem(CACHE_PREFIX + name)); } catch (e) { return null; }
  }
  function writeCache(name, data) {
    try { localStorage.setItem(CACHE_PREFIX + name, JSON.stringify(data)); } catch (e) {}
  }

  // Live copy first (the website, or GitHub Pages for the phone apps), then the copy
  // bundled inside the app. Returns null if neither works.
  async function fetchFresh(name) {
    const urls = isNative ? [REMOTE_BASE + name, "masjids/" + name] : ["masjids/" + name];
    for (const url of urls) {
      try {
        const res = await fetch(url, { cache: "no-cache" });
        if (res.ok) { const data = await res.json(); writeCache(name, data); return data; }
      } catch (e) {}
    }
    return null;
  }

  function validMasjid(m) {
    try {
      const d = new Date();
      iqamahForMasjid(m, d.getFullYear(), d.getMonth() + 1, d.getDate());
      return !!(m.name && m.timeZone);
    } catch (e) { return false; }
  }

  function setMasjid(m) {
    MASJID = m;
    try { localStorage.setItem(MASJID_KEY, m.id); } catch (e) {}
    lastDayKey = ""; lastNextKey = ""; lastRemindLine = "";
    document.title = `${m.name} – Iqamah Times`;
    tick();
    if (window.onMasjidChanged) window.onMasjidChanged();
  }

  // Load one masjid: show the saved copy instantly, then update if the live copy differs.
  async function loadMasjid(id) {
    const file = id + ".json";
    const cached = readCache(file);
    if (cached && validMasjid(cached)) setMasjid(cached);
    const fresh = await fetchFresh(file);
    if (fresh && validMasjid(fresh)) {
      if (!MASJID || MASJID.id !== fresh.id || JSON.stringify(MASJID) !== JSON.stringify(fresh)) setMasjid(fresh);
      return true;
    }
    return !!MASJID;
  }

  /* ---------------- picker screen ---------------- */
  function norm(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }

  function renderList() {
    const q = norm($p("masjidSearch").value).split(/\s+/).filter(Boolean);
    const rows = masjidList.filter((m) => {
      const hay = norm([m.name, m.city, m.address, m.aka].join(" "));
      return q.every((t) => hay.includes(t));
    });
    $p("masjidList").innerHTML = rows.map((m) =>
      `<button class="mrow ${MASJID && MASJID.id === m.id ? "cur" : ""}" data-id="${m.id}">
         <span class="mname"></span><span class="mcity"></span></button>`).join("");
    // text set via textContent so names can never inject markup
    $p("masjidList").querySelectorAll(".mrow").forEach((el, i) => {
      el.querySelector(".mname").textContent = rows[i].name;
      el.querySelector(".mcity").textContent = rows[i].city; // address stays searchable but isn't shown
    });
    $p("pickerMsg").textContent = rows.length ? "" :
      (masjidList.length ? "No masjid matches that search." : "Couldn't load the masjid list. Check your connection and try again.");
    $p("retryBtn").style.display = masjidList.length ? "none" : "block";
  }

  async function openPicker() {
    $p("picker").hidden = false;
    document.body.classList.add("picker-open");
    $p("pickerClose").style.display = MASJID ? "block" : "none"; // can't cancel until one is chosen
    $p("masjidSearch").value = "";
    renderList();
    if (!masjidList.length) await loadList();
    $p("masjidSearch").focus();
  }
  function closePicker() {
    $p("picker").hidden = true;
    document.body.classList.remove("picker-open");
  }

  async function loadList() {
    const list = (await fetchFresh("index.json")) || readCache("index.json");
    if (Array.isArray(list)) masjidList = list;
    renderList();
  }

  $p("masjidSearch").addEventListener("input", renderList);
  $p("pickerClose").onclick = closePicker;
  $p("retryBtn").onclick = async () => { $p("pickerMsg").textContent = "Loading…"; await loadList(); };
  $p("masjid").onclick = openPicker;
  window.openMasjidPicker = openPicker; // used by Settings → Change masjid
  $p("masjidList").onclick = async (e) => {
    const b = e.target.closest(".mrow"); if (!b) return;
    $p("pickerMsg").textContent = "Loading…";
    const ok = await loadMasjid(b.dataset.id);
    if (ok && MASJID && MASJID.id === b.dataset.id) { closePicker(); window.scrollTo(0, 0); }
    else $p("pickerMsg").textContent = "Couldn't load that masjid. Check your connection and try again.";
  };

  // Pick up edited times when the app is reopened
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && MASJID && MASJID.id) loadMasjid(MASJID.id);
  });

  /* ---------------- start ---------------- */
  (async function boot() {
    let id = null;
    try { id = localStorage.getItem(MASJID_KEY); } catch (e) {}
    if (id) await loadMasjid(id);
    if (!MASJID) { await loadList(); openPicker(); }
    else loadList(); // keep the list fresh for the next time the picker opens
  })();
})();
