# Street Food Rush 🌭

A 3D street-food cooking game for mobile: run a food cart in cities around the world,
cook fast and serve customers before they lose patience.

- App id: `com.devfoxmy.streetfoodrush` · portrait · Android (Capacitor 8)
- Engine: three.js + TypeScript, bundled with esbuild
- Languages: English, Français, Español, العربية

## Phase 1 (prototype)
New York, hot dog cart, 3 levels: grill sausages (raw → golden → burnt), buns, ketchup / mustard,
soda (level 3), customers with patience bars, tips, combos, 3 stars per level, tutorial in level 1.

## Build
```
npm ci
npm run build          # www/js/game.js
npx cap sync android
```
GitHub Actions builds `app-debug.apk` and `app-unsigned.aab` on every push and publishes them
to the `builds` branch.

## Local test
```
npm run build && python3 -m http.server -d www 8080
```
