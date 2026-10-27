# Adding a masjid

Each masjid is one JSON file in this folder, plus one line in `index.json`.
Push to GitHub and every phone picks it up the next time it opens the app. No app update needed.

1. Copy `test-masjid.json` (simple, fixed times) or `imof-davie.json` (changes through the year).
2. Fill in `id` (lowercase, dashes, unique), `name`, `city`, `address`, `timeZone`, `lat`/`lon`, `jumuah`, `note`.
3. Add the masjid to `index.json` (`aka` is an optional extra search name).

## Schedule

One entry per prayer: `fajr`, `zuhr`, `asr`, `maghrib`, `isha`. Each is one of:

| Form | Meaning |
|---|---|
| `"6:35 AM"` | Same time all year |
| `{"after": "sunset", "minutes": 5}` | 5 minutes after sunset (the adhan) |
| `[ rule, rule, ... ]` | Different times on different dates; the first matching rule wins |

A rule is `"at": "6:35 AM"` or `"after": "sunset", "minutes": N`, plus an optional date range:
`from` / `to` (inclusive), `since` (inclusive), `until` (exclusive). Dates are `"MM-DD"` or `"MM-sun2"`
(the 2nd Sunday of the month, for daylight saving switches). `jumuah` is a single time.

If a masjid sets iqamah some other way, send it to me and we will add a new kind of rule.
