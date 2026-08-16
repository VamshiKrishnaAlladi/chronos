import type { Page } from '@playwright/test'

export const STORAGE_KEYS = {
  preferences: 'chronos-preferences-v1',
  dashboard: 'chronos-dashboard-v1',
  runtime: 'chronos-runtime-sessions-v1',
} as const

export const defaultPreferences = {
  version: 1,
  data: {
    activeTool: 'countdown',
    appView: 'focus',
    countdownInputParts: { hours: '00', minutes: '05', seconds: '00' },
    pomodoroInputParts: { hours: '00', minutes: '25', seconds: '00' },
    pomoBreakInputParts: { hours: '00', minutes: '05', seconds: '00' },
    pomoSessionsInput: '4',
    soundVolume: 50,
    keepAwake: false,
  },
} as const

export const fourTileDashboard = {
  version: 1,
  data: {
    tiles: [
      { id: 'visual-countdown', kind: 'countdown', name: 'Tea', inputParts: { hours: '00', minutes: '03', seconds: '00' }, breakInputParts: { hours: '00', minutes: '05', seconds: '00' }, sessionsInput: '4' },
      { id: 'visual-timer', kind: 'timer', name: 'Workout', inputParts: { hours: '00', minutes: '00', seconds: '00' }, breakInputParts: { hours: '00', minutes: '05', seconds: '00' }, sessionsInput: '4' },
      { id: 'visual-pomodoro', kind: 'pomodoro', name: 'Deep work', inputParts: { hours: '00', minutes: '25', seconds: '00' }, breakInputParts: { hours: '00', minutes: '05', seconds: '00' }, sessionsInput: '4' },
      { id: 'visual-countdown-2', kind: 'countdown', name: 'Stretch', inputParts: { hours: '00', minutes: '10', seconds: '00' }, breakInputParts: { hours: '00', minutes: '05', seconds: '00' }, sessionsInput: '4' },
    ],
  },
} as const

export const twoTileDashboard = {
  version: 1,
  data: {
    tiles: [
      { id: 'responsive-countdown', kind: 'countdown', name: 'Countdown', inputParts: { hours: '00', minutes: '25', seconds: '00' }, breakInputParts: { hours: '00', minutes: '05', seconds: '00' }, sessionsInput: '4' },
      { id: 'responsive-timer', kind: 'timer', name: 'Split Timer', inputParts: { hours: '00', minutes: '00', seconds: '00' }, breakInputParts: { hours: '00', minutes: '05', seconds: '00' }, sessionsInput: '4' },
    ],
  },
} as const

export const threeTileDashboard = {
  version: 1,
  data: {
    tiles: fourTileDashboard.data.tiles.slice(0, 3),
  },
} as const

export const singleCountdownDashboard = {
  version: 1,
  data: {
    tiles: [fourTileDashboard.data.tiles[0]],
  },
} as const

export const singleSplitDashboard = {
  version: 1,
  data: {
    tiles: [fourTileDashboard.data.tiles[1]],
  },
} as const

export async function resetBrowserState(page: Page): Promise<void> {
  await page.addInitScript((keys) => {
    if (sessionStorage.getItem('chronos-e2e-reset') === 'done') return
    for (const key of Object.values(keys)) localStorage.removeItem(key)
    sessionStorage.setItem('chronos-e2e-reset', 'done')
  }, STORAGE_KEYS)
}

export async function seedStorage(page: Page, values: Record<string, unknown>): Promise<void> {
  await page.addInitScript((entries) => {
    for (const [key, value] of Object.entries(entries)) {
      localStorage.setItem(key, JSON.stringify(value))
    }
  }, values)
}

export async function waitForFonts(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready)
}
