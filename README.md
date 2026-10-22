# IqamaTime

Iqamah times for the masjid in Davie, FL. A vanilla-JS PWA wrapped with Capacitor for Android and iOS.

- Web: deployed on Netlify (`netlify.toml`)
- Build web bundle for native: `npm run build` (copies web files into `www/`)
- Sync to native projects: `npm run sync`
- Android: `npx cap open android` (needs Android Studio)
- iOS: `npx cap open ios` (needs a Mac with Xcode)
