# Chronos

Minimal local-first timekeeping app built with React, TypeScript, and Vite.

## Features

- Focus and dashboard modes
- Countdown timer with overrun readout and page-title overrun display
- Split timer with cumulative and per-split lap recording
- Pomodoro timer with work/break phases and session tracking
- Dashboard tiles for running multiple timers side by side
- `HH:MM:SS` segmented input with auto-advance and manual traversal
- Repeating completion alarm until dismissed
- Theme-matched sound volume control
- Progress rail that updates in whole-second steps
- Local-first preferences and dashboard persistence
- Installable app with generated offline precaching and explicit update prompts

## Offline and updates

Production builds generate a Workbox service worker from the compiled output. The HTML app shell, hashed JavaScript and CSS, favicon, web manifest, and alarm audio are revisioned and precached automatically. Navigations prefer the network and fall back to the precached app shell when offline.

Inter (400/500/600) and Orbitron (500/700) are self-hosted from exact-version `@fontsource` packages. Both packages use the SIL Open Font License 1.1. Vite emits only their selected Latin WOFF2 files as hashed assets, and the generated service worker precaches them. The build finishes by checking the emitted font files, compiled CSS, and service-worker precache entries; Chronos has no runtime dependency on Google Fonts.

New service workers wait instead of replacing the running version. Chronos shows an accessible update prompt when a new version is ready and only reloads after **Update** is selected; **Later** leaves the current version running. Active timer sessions are persisted separately and restore after that reload.

Service workers are disabled during `npm run dev`. Development startup also unregisters workers and removes app-shell caches left by a production preview on the same origin, then reloads once if an old worker was controlling the page.

## Production security headers

`vercel.json` applies a self-only Content Security Policy and supporting browser security headers to every production route. Scripts, fonts, audio, images, workers, manifests, and network connections are restricted to this origin. Inline scripts are forbidden. The existing progress rail uses a dynamic React style attribute, so inline style attributes remain allowed while inline `<style>` elements are restricted in CSP Level 3 browsers.

Wake Lock is explicitly allowed for Chronos itself. Browser notifications do not have a standardized Permissions Policy directive and are therefore left governed by the browser's normal user-permission prompt. HSTS is intentionally not duplicated in `vercel.json`; it remains managed by the hosting platform.

## Development

```bash
npm install
npm run dev
```

## Checks

```bash
npm run lint
npm run test:run
npm run build
npx playwright install chromium
npm run test:e2e
```

`npm run verify:dist` can also be run after a production build to validate the local font output and precache manifest directly.

The Playwright suite runs against the production build served by `npm run preview`. It covers the critical focus and dashboard workflows, session restoration, keyboard and modal behavior, responsive overflow, production offline/update behavior, automated axe scans, and committed Chromium visual baselines. Run `npm run build` before it locally; use `npm run test:e2e:update` only when an intentional UI change requires reviewed baseline updates.

GitHub Actions runs two independent jobs on pull requests and `main`: one enforces lint, unit/integration tests, and production artifact verification; the other installs Chromium and runs the production browser, accessibility, and visual suite. Failed browser runs upload traces, screenshots, videos, and the HTML report for seven days.

Automated accessibility checks are a regression guard, not a substitute for periodic VoiceOver/NVDA and real-device PWA, notification, and Wake Lock testing.
