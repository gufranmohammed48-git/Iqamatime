/* ============================================================
   IQAMAH SCHEDULE — copied from the masjid's yearly chart
   (Modified Iqaamah Schedule, approved July 6, 2025)

   Each FAJR / MAGHRIB / ISHA row = one 5-day block,
   with 12 columns for Jan → Dec:
     row 0: 1st–5th   row 1: 6th–10th   row 2: 11th–15th
     row 3: 16th–20th row 4: 21st–25th  row 5: 26th–end of month
   ZUHR / ASR are one value per month.

   "A/B" = Daylight Saving switch inside that block:
     March:    A before DST starts (2nd Sunday), B from that day on
     November: A before DST ends (1st Sunday),   B from that day on

   To update the schedule later, just edit these rows.
   ============================================================ */

const MASJID = {
  name: "IMOF Masjid",
  city: "Davie, FL",
  timeZone: "America/New_York",
  jumuah: "1:35",
};

const FAJR = [
  "6:15 6:10 5:50 6:20 5:50 5:30 5:30 5:50 6:10 6:25 6:40/5:40 6:00",
  "6:15 6:10 5:45/6:45 6:15 5:45 5:30 5:35 5:55 6:10 6:25 6:40/5:40 6:05",
  "6:15 6:05 5:40/6:40 6:10 5:40 5:30 5:35 5:55 6:15 6:30 5:45 6:05",
  "6:15 6:05 6:35 6:05 5:35 5:30 5:40 6:00 6:15 6:30 5:45 6:10",
  "6:15 6:00 6:30 6:00 5:30 5:30 5:40 6:00 6:20 6:35 5:50 6:10",
  "6:15 5:55 6:25 5:55 5:30 5:30 5:45 6:05 6:20 6:40 5:55 6:15",
];

const ZUHR = "12:50 12:50 12:50/1:50 1:50 1:50 1:50 1:50 1:50 1:50 1:50 1:50/12:50 12:50";
const ASR  = "4:15 4:15 4:15/5:15 5:15 5:15 5:15 5:15 5:15 5:15 5:15 5:15/4:15 4:15";

const MAGHRIB = [
  "5:55 6:20 6:35 7:50 8:05 8:25 8:30 8:20 7:55 7:20 6:50/5:50 5:40",
  "6:00 6:25 6:40/7:40 7:55 8:10 8:25 8:30 8:15 7:45 7:15 5:50 5:45",
  "6:05 6:30 6:40/7:40 7:55 8:15 8:25 8:30 8:15 7:40 7:10 5:50 5:45",
  "6:05 6:30 7:45 8:00 8:15 8:30 8:30 8:10 7:35 7:05 5:45 5:45",
  "6:10 6:35 7:45 8:00 8:20 8:30 8:25 8:05 7:30 7:00 5:45 5:50",
  "6:15 6:35 7:50 8:05 8:20 8:30 8:25 8:00 7:25 6:55 5:40 5:55",
];

const ISHA = [
  "7:30 7:40 8:00 9:10 9:30 9:55 10:00 9:45 9:15 8:40 8:15/7:30 7:30",
  "7:30 7:45 8:00/9:00 9:15 9:35 9:55 10:00 9:40 9:10 8:35 8:15/7:30 7:30",
  "7:30 7:45 8:00/9:00 9:20 9:40 10:00 10:00 9:35 9:05 8:30 7:30 7:30",
  "7:30 7:50 9:05 9:20 9:45 10:00 9:55 9:30 9:00 8:25 7:30 7:30",
  "7:30 7:50 9:05 9:25 9:45 10:00 9:55 9:25 8:55 8:20 7:30 7:30",
  "7:35 7:50 9:10 9:30 9:50 10:00 9:50 9:20 8:50 8:15 7:30 7:30",
];

/* ---------------- logic (no need to edit below) ---------------- */

// Day of month of the nth Sunday (month is 0-based)
function nthSunday(year, month, n) {
  const firstDow = new Date(Date.UTC(year, month, 1)).getUTCDay();
  return 1 + ((7 - firstDow) % 7) + 7 * (n - 1);
}

function blockIndex(day) {
  if (day <= 5) return 0;
  if (day <= 10) return 1;
  if (day <= 15) return 2;
  if (day <= 20) return 3;
  if (day <= 25) return 4;
  return 5;
}

// Pick the cell for a date; resolve "A/B" around the DST switch day
function pickCell(row, year, month, day) {
  const cell = row.trim().split(/\s+/)[month];
  if (!cell.includes("/")) return cell;
  const [before, after] = cell.split("/");
  let switchDay = null;
  if (month === 2) switchDay = nthSunday(year, 2, 2);   // March: DST starts
  if (month === 10) switchDay = nthSunday(year, 10, 1); // November: DST ends
  return switchDay !== null && day >= switchDay ? after : before;
}

// "6:30" → minutes after midnight (Fajr is AM, the rest PM)
function toMinutes(str, prayer) {
  let [h, m] = str.split(":").map(Number);
  if (prayer !== "fajr" && h !== 12) h += 12;
  return h * 60 + m;
}

// Iqamah times for a calendar date (month is 1-based here)
function iqamahFor(year, month1, day) {
  const mo = month1 - 1;
  const b = blockIndex(day);
  const dow = new Date(Date.UTC(year, mo, day)).getUTCDay();
  const raw = {
    fajr: pickCell(FAJR[b], year, mo, day),
    zuhr: pickCell(ZUHR, year, mo, day),
    asr: pickCell(ASR, year, mo, day),
    maghrib: pickCell(MAGHRIB[b], year, mo, day),
    isha: pickCell(ISHA[b], year, mo, day),
  };
  const out = {};
  for (const k in raw) out[k] = toMinutes(raw[k], k);
  out.jumuah = toMinutes(MASJID.jumuah, "jumuah");
  out.isFriday = dow === 5;
  return out;
}

if (typeof module !== "undefined") module.exports = { iqamahFor, nthSunday, MASJID };
