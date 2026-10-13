/* ============================================================
   Reminder settings — saved on each person's own phone.
   lead:    minutes before iqamah (0 = off)
   mode:    "notify" = notification only, "adhan" = notification + adhan audio
   prayers: which prayers to be reminded about
   ============================================================ */

const SETTINGS_KEY = "iqamahSettings";
const FIRED_KEY = "iqamahFired";
const DEFAULTS = {
  lead: 20,
  mode: "notify",
  prayers: { fajr: true, zuhr: true, asr: true, maghrib: true, isha: true, jumuah: true },
};
const PRAYER_LABELS = { fajr: "Fajr", zuhr: "Zuhr", asr: "Asr", maghrib: "Maghrib", isha: "Isha", jumuah: "Jumu'ah" };

function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    if (s) return { ...DEFAULTS, ...s, prayers: { ...DEFAULTS.prayers, ...(s.prayers || {}) } };
  } catch (e) {}
  return JSON.parse(JSON.stringify(DEFAULTS));
}
function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) {}
  renderSettings();
  if (window.onSettingsChanged) window.onSettingsChanged(settings); // hook for push sync (next step)
}
let settings = loadSettings();

/* ---------------- settings sheet ---------------- */
const $ = (id) => document.getElementById(id);
const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
const onIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

function renderSettings() {
  document.querySelectorAll("#leadSeg button").forEach((b) =>
    b.classList.toggle("on", Number(b.dataset.v) === settings.lead));
  document.querySelectorAll('input[name="mode"]').forEach((r) => (r.checked = r.value === settings.mode));
  $("prayerChips").innerHTML = Object.keys(PRAYER_LABELS).map((k) =>
    `<button class="chip ${settings.prayers[k] ? "on" : ""}" data-k="${k}">${PRAYER_LABELS[k]}</button>`).join("");
  renderStatus();
  lastRemindLine = "";
}

function renderStatus() {
  const el = $("notifStatus");
  el.className = "status";
  if (!("Notification" in window)) {
    $("enableBtn").style.display = "none";
    el.textContent = onIOS && !isStandalone
      ? "On iPhone: add this app to your Home Screen first, then open it from there to turn on notifications."
      : "This browser doesn't support notifications. The adhan will still play while the app is open.";
    return;
  }
  const perm = Notification.permission;
  $("enableBtn").style.display = perm === "granted" ? "none" : "block";
  if (perm === "granted") {
    el.className = "status ok";
    el.textContent = settings.lead
      ? `✓ Notifications are on. You'll be reminded ${settings.lead} minutes before iqamah.`
      : "✓ Notifications are on, but reminders are set to Off.";
  } else if (perm === "denied") {
    el.textContent = "Notifications are blocked. Turn them on for this app in your phone's settings.";
  } else {
    el.textContent = "Tap above so your phone can show prayer reminders.";
  }
}

$("openSettings").onclick = () => { renderSettings(); document.body.classList.add("settings-open"); };
$("closeSettings").onclick = $("sheetBg").onclick = () => document.body.classList.remove("settings-open");
$("leadSeg").onclick = (e) => {
  const b = e.target.closest("button"); if (!b) return;
  settings.lead = Number(b.dataset.v); saveSettings();
};
document.querySelectorAll('input[name="mode"]').forEach((r) =>
  r.addEventListener("change", () => { settings.mode = r.value; saveSettings(); unlockAudio(); }));
$("prayerChips").onclick = (e) => {
  const b = e.target.closest(".chip"); if (!b) return;
  settings.prayers[b.dataset.k] = !settings.prayers[b.dataset.k]; saveSettings();
};
$("enableBtn").onclick = async () => {
  unlockAudio();
  try { await Notification.requestPermission(); } catch (e) {}
  renderStatus();
};
$("testBtn").onclick = () => {
  unlockAudio();
  const t = iqamahFor(masjidNow().y, masjidNow().m, masjidNow().d);
  fireReminder({ key: "asr", name: "Asr", mins: t.asr }, settings.lead || 20, true);
};

/* ---------------- adhan audio ---------------- */
const audio = $("adhanAudio");
let adhanFileMissing = false;
audio.addEventListener("error", () => (adhanFileMissing = true));
let audioUnlocked = false;

// Phones only allow sound after a tap, so we "unlock" audio on the first tap
function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  audio.muted = true;
  audio.play().then(() => { audio.pause(); audio.currentTime = 0; audio.muted = false; })
    .catch(() => { audio.muted = false; });
}
document.addEventListener("click", unlockAudio, { once: true });

// Fallback chime if no adhan.mp3 has been added yet
function chime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.45, 0.9].forEach((t, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = [659, 784, 988][i];
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 1.2);
      o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 1.3);
    });
  } catch (e) {}
}

function playAdhan() {
  $("adhanBanner").classList.remove("show");
  if (adhanFileMissing) { chime(); return Promise.resolve(); }
  audio.currentTime = 0;
  return audio.play().catch(() => {
    if (adhanFileMissing) chime(); else $("adhanBanner").classList.add("show");
  });
}
$("playAdhanBtn").onclick = () => { audioUnlocked = true; playAdhan(); };

/* ---------------- reminders ---------------- */
async function fireReminder(p, lead, isTest = false) {
  const title = isTest ? `Test: ${p.name} iqamah in ${lead} min` : `${p.name} iqamah in ${lead} min`;
  const body = `Iqamah at ${fmt(p.mins)}. Time to head to the masjid.`;
  const withAdhan = settings.mode === "adhan";

  if ("Notification" in window && Notification.permission === "granted") {
    try {
      const reg = await navigator.serviceWorker.ready;
      reg.showNotification(title, {
        body, icon: "icons/icon-192.png", badge: "icons/icon-192.png",
        tag: `iqamah-${p.key}`, renotify: true, data: { adhan: withAdhan },
      });
    } catch (e) { try { new Notification(title, { body, icon: "icons/icon-192.png" }); } catch (_) {} }
  }
  if (withAdhan) {
    $("adhanText").textContent = `${p.name} iqamah at ${fmt(p.mins)}`;
    playAdhan();
  } else if (isTest && Notification.permission !== "granted") {
    chime();
  }
}

function getFired() { try { return JSON.parse(localStorage.getItem(FIRED_KEY)) || {}; } catch (e) { return {}; } }
function setFired(f) { try { localStorage.setItem(FIRED_KEY, JSON.stringify(f)); } catch (e) {} }

let lastRemindLine = "";
// Called every second by app.js
window.onTick = (now, next) => {
  // Header line
  let line = "Reminders off";
  if (settings.lead) {
    const k = next.item.key, enabled = settings.prayers[k] ?? true;
    const at = next.item.mins - settings.lead;
    line = enabled && next.idx !== -1 && at * 60 > now.secs
      ? `🔔 Reminder at ${fmt(at)}${settings.mode === "adhan" ? " with adhan" : ""}`
      : `🔔 ${settings.lead} min reminders on`;
  }
  if (line !== lastRemindLine) { $("remindLine").textContent = line; lastRemindLine = line; }

  if (!settings.lead) return;
  const dayKey = `${now.y}-${now.m}-${now.d}`;
  const fired = getFired();
  for (const k in fired) if (!k.startsWith(dayKey)) delete fired[k];

  const list = dayList(iqamahFor(now.y, now.m, now.d));
  for (const p of list) {
    if (!settings.prayers[p.key]) continue;
    const remindAt = (p.mins - settings.lead) * 60;
    const id = `${dayKey}-${p.key}`;
    // fire within a 2-minute window so opening the app late doesn't surprise anyone
    if (now.secs >= remindAt && now.secs < remindAt + 120 && !fired[id]) {
      fired[id] = true;
      fireReminder(p, settings.lead);
    }
  }
  setFired(fired);
};

// Opened from a notification that asked for the adhan
if (new URLSearchParams(location.search).get("adhan") === "1") {
  $("adhanText").textContent = "It's almost time for iqamah";
  playAdhan();
  history.replaceState(null, "", location.pathname);
}
navigator.serviceWorker && navigator.serviceWorker.addEventListener("message", (e) => {
  if (e.data === "play-adhan") playAdhan();
});

renderSettings();
tick();
