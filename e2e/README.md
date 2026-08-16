# Browser test suite

`npm run test:e2e` runs against an already-built production `dist` directory.
Build first with `npm run build`; the browser script deliberately does not rebuild.

The committed screenshots cover 320 px, 390 px, and desktop Chromium at a
device scale factor of 1. Chronos self-hosts its fonts, animations and carets are
disabled during capture, and the snapshot path does not include the host OS.
These constraints keep the baselines stable between local Chromium and Ubuntu
CI. When an intentional UI change occurs, run `npm run test:e2e:update`, inspect
every changed PNG, then commit the approved baselines.

The PWA update test temporarily appends a revision comment to `dist/sw.js` and
always restores the file. The suite therefore uses one Playwright worker.
