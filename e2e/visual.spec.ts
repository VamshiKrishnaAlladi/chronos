import { expect, test } from '@playwright/test'
import { defaultPreferences, fourTileDashboard, resetBrowserState, seedStorage, STORAGE_KEYS, waitForFonts } from './helpers'

test('focus view visual baseline', async ({ page }) => {
  await resetBrowserState(page)
  await seedStorage(page, {
    [STORAGE_KEYS.preferences]: defaultPreferences,
    [STORAGE_KEYS.runtime]: {
      version: 1,
      sessions: {
        'focus:countdown': {
          kind: 'countdown',
          state: {
            durationMs: 300_000,
            remainingMs: 125_000,
            overrunMs: 0,
            endsAt: null,
            status: 'paused',
            completedAt: null,
            alertedAt: null,
          },
        },
      },
    },
  })
  await page.goto('/')
  await waitForFonts(page)
  await expect(page).toHaveScreenshot('focus-paused.png', { fullPage: true })
})

test('dashboard view visual baseline', async ({ page }) => {
  await resetBrowserState(page)
  await seedStorage(page, {
    [STORAGE_KEYS.preferences]: {
      ...defaultPreferences,
      data: { ...defaultPreferences.data, appView: 'dashboard' },
    },
    [STORAGE_KEYS.dashboard]: fourTileDashboard,
  })
  await page.goto('/')
  await waitForFonts(page)
  await expect(page).toHaveScreenshot('dashboard-four-tiles.png', { fullPage: true })
})
