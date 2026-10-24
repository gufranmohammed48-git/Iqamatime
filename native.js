/* ============================================================
   Native (Android / iOS app) reminders.
   Only runs inside the Capacitor app; on the website this file does nothing.
   Instead of waiting for the app to be open, it hands the next
   DAYS_AHEAD days of reminders to the phone's own alarm system, so
   they fire on time even when the app is closed.
   ============================================================ */

(function () {
  const cap = window.Capacitor;
  if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) return;
  const LN = cap.Plugins.LocalNotifications;
  if (!LN) return;

  const DAYS_AHEAD = 14;
  const CHANNEL = "iqamah-reminders";

  // Epoch ms for a wall-clock time at the masjid (handles daylight saving)
  function masjidEpoch(y, m, d, mins) {
    const wanted = Date.UTC(y, m - 1, d, 0, mins);
    let guess = wanted;
    for (let i = 0; i < 2; i++) {
      const p = {};
      new Intl.DateTimeFormat("en-US", {
        timeZone: MASJID.timeZone, year: "numeric", month: "numeric", day: "numeric",
        hour: "numeric", minute: "numeric", hourCycle: "h23",
      }).formatToParts(new Date(guess)).forEach((x) => (p[x.type] = Number(x.value)));
      const shown = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
      guess += wanted - shown;
    }
    return guess;
  }

  async function permissionGranted() {
    try { return (await LN.checkPermissions()).display === "granted"; } catch (e) { return false; }
  }

  async function ensureExactAlarms() {
    try {
      const s = await LN.checkExactNotificationSetting();
      if (s.exact_alarm !== "granted") await LN.changeExactNotificationSetting();
    } catch (e) {} // not Android 12+ or not supported: nothing to do
  }

  let scheduling = Promise.resolve();
  function rescheduleAll() {
    scheduling = scheduling.then(doReschedule).catch(() => {});
    return scheduling;
  }

  async function doReschedule() {
    const pending = await LN.getPending();
    if (pending.notifications.length) await LN.cancel({ notifications: pending.notifications });
    if (!settings.lead || !(await permissionGranted())) return;

    try { await LN.createChannel({ id: CHANNEL, name: "Iqamah reminders", importance: 4, visibility: 1 }); } catch (e) {}

    const now = masjidNow();
    const nowMs = Date.now();
    const list = [];
    for (let i = 0; i < DAYS_AHEAD; i++) {
      const day = addDays(now.y, now.m, now.d, i);
      const dayNum = day.y * 10000 + day.m * 100 + day.d;
      dayList(iqamahFor(day.y, day.m, day.d)).forEach((p, idx) => {
        if (settings.prayers[p.key] === "off") return;
        const at = masjidEpoch(day.y, day.m, day.d, p.mins - settings.lead);
        if (at <= nowMs + 5000) return;
        list.push({
          id: dayNum * 10 + idx,
          title: `${p.name} iqamah in ${settings.lead} min`,
          body: `Iqamah at ${fmt(p.mins)}. Time to head to the masjid.`,
          channelId: CHANNEL,
          schedule: { at: new Date(at), allowWhileIdle: true },
        });
      });
    }
    if (list.length) await LN.schedule({ notifications: list });
  }

  // Notification status text + enable button, using the native permission
  window.renderStatus = async function () {
    const el = document.getElementById("notifStatus");
    const btn = document.getElementById("enableBtn");
    const ok = await permissionGranted();
    btn.style.display = ok ? "none" : "block";
    el.className = ok ? "status ok" : "status";
    el.textContent = ok
      ? (settings.lead
          ? `✓ Notifications are on. You'll be reminded ${settings.lead} minutes before iqamah, even when the app is closed.`
          : "✓ Notifications are on, but reminders are set to Off.")
      : "Tap above so your phone can show prayer reminders.";
  };
  document.getElementById("enableBtn").onclick = async () => {
    try { await LN.requestPermissions(); } catch (e) {}
    await ensureExactAlarms();
    await window.renderStatus();
    rescheduleAll();
  };

  // While the app is open, the in-app timer still plays the adhan (the webview has no
  // Notification API, so it shows nothing itself). The test button uses a native alert.
  window.fireReminder = (function (orig) {
    return function (p, lead, isTest) {
      if (isTest) {
        LN.schedule({ notifications: [{
          id: 1, title: `Test: ${p.name} iqamah in ${lead} min`,
          body: `Iqamah at ${fmt(p.mins)}. Time to head to the masjid.`,
          channelId: CHANNEL, schedule: { at: new Date(Date.now() + 2000) },
        }] }).catch(() => {});
      }
      return orig(p, lead, isTest);
    };
  })(window.fireReminder);

  window.onSettingsChanged = rescheduleAll;
  document.addEventListener("visibilitychange", () => { if (!document.hidden) rescheduleAll(); });
  window.renderStatus();
  rescheduleAll();
})();
