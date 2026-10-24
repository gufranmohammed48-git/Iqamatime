/* ============================================================
   IQAMAH SCHEDULE ENGINE
   Every masjid is a JSON file in masjids/ (see masjids/README.md).
   This file turns a masjid's rules into iqamah times for a date.

   A masjid's "schedule" has one entry per prayer: fajr, zuhr, asr,
   maghrib, isha. Each entry is one of:
     "6:35 AM"                            fixed time all year
     { "after": "sunset", "minutes": 5 }  minutes after sunset (the adhan)
     [ rule, rule, ... ]                  different times on different dates

   A rule is a fixed time or an "after sunset" offset, plus an optional
   date range (the first rule that matches the date wins):
     from / to   "MM-DD" or "MM-sunN" (Nth Sunday of the month), inclusive
     since       same format, inclusive lower limit  (daylight saving switch)
     until       same format, EXCLUSIVE upper limit  (daylight saving switch)
   ============================================================ */

let MASJID = null; // the selected masjid's data (set by picker.js)

const PRAYER_KEYS = ["fajr", "zuhr", "asr", "maghrib", "isha"];

// Day of month of the nth Sunday (month is 0-based)
function nthSunday(year, month, n) {
  const firstDow = new Date(Date.UTC(year, month, 1)).getUTCDay();
  return 1 + ((7 - firstDow) % 7) + 7 * (n - 1);
}

// "6:35 AM" / "1:30 PM" / "13:30" -> minutes after midnight
function parseTime(str) {
  const m = /^\s*(\d{1,2}):(\d{2})\s*([AaPp][Mm])?\s*$/.exec(str);
  if (!m) throw new Error(`Bad time "${str}"`);
  let h = Number(m[1]);
  const min = Number(m[2]), ap = m[3] && m[3].toUpperCase();
  if (ap === "PM" && h !== 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  return h * 60 + min;
}

// "03-08" or "03-sun2" -> month*100+day for a given year
function pointKey(token, year) {
  const a = /^(\d{2})-(\d{2})$/.exec(token);
  if (a) return Number(a[1]) * 100 + Number(a[2]);
  const b = /^(\d{2})-sun(\d)$/.exec(token);
  if (b) return Number(b[1]) * 100 + nthSunday(year, Number(b[1]) - 1, Number(b[2]));
  throw new Error(`Bad date "${token}"`);
}

function ruleMatches(r, year, key) {
  if (r.from && key < pointKey(r.from, year)) return false;
  if (r.to && key > pointKey(r.to, year)) return false;
  if (r.since && key < pointKey(r.since, year)) return false;
  if (r.until && key >= pointKey(r.until, year)) return false;
  return true;
}

/* ---- sunset (NOAA / "sunrise equation"), returned as minutes after local midnight at the masjid ---- */
function sunsetMinutes(masjid, year, month1, day) {
  const rad = Math.PI / 180, lat = masjid.lat, lon = masjid.lon;
  const jdLocalNoon = Date.UTC(year, month1 - 1, day, 12) / 86400000 + 2440587.5 - lon / 360;
  const n = Math.round(jdLocalNoon - 2451545.0);
  const js = n + 0.0009 - lon / 360;            // lon: east positive, west negative
  const M = (357.5291 + 0.98560028 * js) % 360;
  const C = 1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad);
  const lambda = (M + C + 180 + 102.9372) % 360;
  const jTransit = 2451545.0 + js + 0.0053 * Math.sin(M * rad) - 0.0069 * Math.sin(2 * lambda * rad);
  const sinDelta = Math.sin(lambda * rad) * Math.sin(23.4397 * rad);
  const cosDelta = Math.cos(Math.asin(sinDelta));
  const cosW = (Math.sin(-0.833 * rad) - Math.sin(lat * rad) * sinDelta) / (Math.cos(lat * rad) * cosDelta);
  if (cosW < -1 || cosW > 1) throw new Error("No sunset on this date at this latitude");
  const jSet = jTransit + Math.acos(cosW) / (2 * Math.PI);
  const utcMs = (jSet - 2440587.5) * 86400000;
  const p = {};
  new Intl.DateTimeFormat("en-US", { timeZone: masjid.timeZone, hour: "numeric", minute: "numeric", second: "numeric", hourCycle: "h23" })
    .formatToParts(new Date(utcMs)).forEach((x) => (p[x.type] = Number(x.value)));
  return Math.round(p.hour * 60 + p.minute + p.second / 60);
}

function resolveEntry(entry, masjid, year, month1, day) {
  if (typeof entry === "string") return parseTime(entry);
  if (entry.at) return parseTime(entry.at);
  if (entry.after === "sunset") return sunsetMinutes(masjid, year, month1, day) + (entry.minutes || 0);
  throw new Error("Rule needs 'at' or 'after'");
}

function minutesFor(masjid, prayer, year, month1, day) {
  const entry = masjid.schedule[prayer];
  if (!Array.isArray(entry)) return resolveEntry(entry, masjid, year, month1, day);
  const key = month1 * 100 + day;
  const rule = entry.find((r) => ruleMatches(r, year, key));
  if (!rule) throw new Error(`${masjid.name}: no ${prayer} rule covers ${month1}/${day}`);
  return resolveEntry(rule, masjid, year, month1, day);
}

// Iqamah times (minutes after midnight) for one masjid on a calendar date (month is 1-based)
function iqamahForMasjid(masjid, year, month1, day) {
  const dow = new Date(Date.UTC(year, month1 - 1, day)).getUTCDay();
  const out = {};
  for (const k of PRAYER_KEYS) out[k] = minutesFor(masjid, k, year, month1, day);
  out.jumuah = parseTime(masjid.jumuah);
  out.isFriday = dow === 5;
  return out;
}

// Same, for the masjid the user picked
function iqamahFor(year, month1, day) {
  return iqamahForMasjid(MASJID, year, month1, day);
}

if (typeof module !== "undefined") module.exports = { iqamahForMasjid, sunsetMinutes, parseTime, nthSunday };
