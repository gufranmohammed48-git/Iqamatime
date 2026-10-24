// Copies the web app files into www/ so Capacitor can bundle them.
const fs = require("fs");
const files = ["index.html", "app.js", "schedule.js", "settings.js", "native.js", "picker.js", "sw.js", "manifest.json"];
fs.rmSync("www", { recursive: true, force: true });
fs.mkdirSync("www", { recursive: true });
for (const f of files) fs.copyFileSync(f, `www/${f}`);
fs.cpSync("icons", "www/icons", { recursive: true });
fs.cpSync("masjids", "www/masjids", { recursive: true });
if (fs.existsSync("adhan.mp3")) fs.copyFileSync("adhan.mp3", "www/adhan.mp3");
