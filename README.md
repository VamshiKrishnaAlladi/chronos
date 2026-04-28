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
- Installable/offline-friendly app shell via service worker and web manifest

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
```
