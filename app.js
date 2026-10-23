const PRAYERS = [
  { key: "fajr", name: "Fajr" },
  { key: "zuhr", name: "Zuhr" },
  { key: "asr", name: "Asr" },
  { key: "maghrib", name: "Maghrib" },
  { key: "isha", name: "Isha" },
];

// Current date/time at the masjid (works even if the phone is set elsewhere)
function masjidNow() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MASJID.timeZone, year: "numeric", month: "numeric", day: "numeric",
    hour: "numeric", minute: "numeric", second: "numeric", hourCycle: "h23",
  }).formatToParts(new Date());
  const p = {};
  parts.forEach((x) => (p[x.type] = Number(x.value)));
  return { y: p.year, m: p.month, d: p.day, secs: p.hour * 3600 + p.minute * 60 + p.second };
}

function addDays(y, m, d, n) {
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate(), dow: dt.getUTCDay() };
}

function fmt(mins, withAmPm = true) {
  let h = Math.floor(mins / 60), m = mins % 60;
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")}${withAmPm ? " " + ap : ""}`;
}

// Today's list in order; on Friday, Jumu'ah takes Zuhr's place
function dayList(t) {
  return PRAYERS.map((p) =>
    p.key === "zuhr" && t.isFriday
      ? { key: "jumuah", name: "Jumu'ah", mins: t.jumuah }
      : { key: p.key, name: p.name, mins: t[p.key] }
  );
}

function findNext(now) {
  const today = iqamahFor(now.y, now.m, now.d);
  const list = dayList(today);
  const nowMins = now.secs / 60;
  const idx = list.findIndex((p) => p.mins > nowMins);
  if (idx >= 0) return { idx, item: list[idx], secsLeft: list[idx].mins * 60 - now.secs };
  const tm = addDays(now.y, now.m, now.d, 1);
  const tFajr = iqamahFor(tm.y, tm.m, tm.d).fajr;
  return { idx: -1, item: { key: "fajr", name: "Fajr (tomorrow)", mins: tFajr }, secsLeft: 86400 - now.secs + tFajr * 60 };
}

function renderStatic(now) {
  document.getElementById("masjid").textContent = `${MASJID.name} · ${MASJID.city}`;

  const base = new Date(Date.UTC(now.y, now.m - 1, now.d, 12));
  const greg = base.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
  let hijri = "";
  try {
    // Built from parts so the era shows as "AH" (Hijri), never "BC"/"BCE"
    const h = {};
    new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
      .formatToParts(base).forEach((x) => (h[x.type] = x.value));
    hijri = `${h.day} ${h.month} ${h.year} AH`;
  } catch (e) {}
  document.getElementById("dates").textContent = hijri ? `${greg} · ${hijri}` : greg;

  // Week table
  let html = "<tr><th>Day</th><th>Fajr</th><th>Zuhr</th><th>Asr</th><th>Magh</th><th>Isha</th></tr>";
  for (let i = 0; i < 7; i++) {
    const d = addDays(now.y, now.m, now.d, i);
    const t = iqamahFor(d.y, d.m, d.d);
    const label = i === 0 ? "Today" : new Date(Date.UTC(d.y, d.m - 1, d.d)).toLocaleDateString("en-US", { weekday: "short", day: "numeric", timeZone: "UTC" });
    const zuhr = t.isFriday ? `${fmt(t.jumuah, false)}<div style="font-size:10px;color:var(--gold)">Jumu'ah</div>` : fmt(t.zuhr, false);
    html += `<tr class="${i === 0 ? "today" : ""} ${t.isFriday ? "fri" : ""}">
      <td>${label}</td><td>${fmt(t.fajr, false)}</td><td>${zuhr}</td>
      <td>${fmt(t.asr, false)}</td><td>${fmt(t.maghrib, false)}</td><td>${fmt(t.isha, false)}</td></tr>`;
  }
  document.getElementById("week").innerHTML = html;
}

function renderToday(now, next) {
  const t = iqamahFor(now.y, now.m, now.d);
  const list = dayList(t);
  let html = list.map((p, i) => {
    const cls = i === next.idx ? "next" : (next.idx === -1 || i < next.idx) ? "past" : "";
    const sub = p.key === "jumuah" ? '<div class="sub">Friday prayer</div>' : "";
    return `<div class="row ${cls}"><div><div class="name">${p.name}</div>${sub}</div><div class="time">${fmt(p.mins)}</div></div>`;
  }).join("");
  if (!t.isFriday) {
    html += `<div class="row"><div><div class="name">Jumu'ah</div><div class="sub">Every Friday</div></div><div class="time">${fmt(t.jumuah)}</div></div>`;
  }
  document.getElementById("today").innerHTML = html;
}

let lastDayKey = "", lastNextKey = "";
function tick() {
  const now = masjidNow();
  const next = findNext(now);
  const dayKey = `${now.y}-${now.m}-${now.d}`;
  if (dayKey !== lastDayKey) { renderStatic(now); lastDayKey = dayKey; lastNextKey = ""; }
  if (next.item.name !== lastNextKey) { renderToday(now, next); lastNextKey = next.item.name; }

  document.getElementById("nextName").textContent = next.item.name;
  document.getElementById("nextTime").textContent = fmt(next.item.mins);
  const s = Math.max(0, next.secsLeft);
  const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
  document.getElementById("countdown").textContent =
    `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  if (window.onTick) window.onTick(now, next);
}

tick();
setInterval(tick, 1000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) { lastDayKey = ""; tick(); } });

// ---------- Install help ----------
const box = document.getElementById("install");
const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
let deferredPrompt = null;

if (!standalone && isIOS) {
  box.innerHTML = "<b>Add to your Home Screen</b><br>Tap the <b>Share</b> button in Safari, then <b>Add to Home Screen</b>.";
  box.classList.add("show");
}
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  box.innerHTML = "<b>Install this app</b><br>Get iqamah times right from your home screen, even offline.<button id='installBtn'>Install</button>";
  box.classList.add("show");
  document.getElementById("installBtn").onclick = async () => {
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    box.classList.remove("show");
  };
});

// ---------- Offline support ----------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js"));
}
