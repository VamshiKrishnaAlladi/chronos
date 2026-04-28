import type { DashboardTileConfig, ToolKind } from '../types'
import { TOOL_LABELS } from '../types'
import { splitTimeParts, parseStoredTimeParts } from './time'
import {
  DEFAULT_COUNTDOWN_INPUT,
  DEFAULT_POMODORO_BREAK_INPUT,
  DEFAULT_POMODORO_INPUT,
  DEFAULT_POMODORO_SESSIONS,
} from './defaults'
import { createLocalPreferenceStore } from './localPreferenceStore'

const DASHBOARD_STORAGE_KEY = 'chronos-dashboard-v1'

export interface DashboardPreferences {
  tiles: DashboardTileConfig[]
}

const DEFAULTS: DashboardPreferences = { tiles: [] }

export function parseDashboardPreferences(value: unknown): DashboardPreferences {
  const parsed = value as { tiles?: unknown }
  if (!Array.isArray(parsed.tiles)) return DEFAULTS

  const validKinds = ['countdown', 'timer', 'pomodoro']

  const tiles: DashboardTileConfig[] = parsed.tiles
    .slice(0, 4)
    .filter((t: unknown): t is Record<string, unknown> => {
      if (!t || typeof t !== 'object') return false
      const obj = t as Record<string, unknown>
      return typeof obj.id === 'string' && validKinds.includes(obj.kind as string)
    })
    .map((t: Record<string, unknown>) => {
      const kind = t.kind as ToolKind
      const defaultInput = kind === 'pomodoro'
        ? DEFAULT_POMODORO_INPUT
        : kind === 'timer'
          ? '00:00:00'
          : DEFAULT_COUNTDOWN_INPUT

      return {
        id: t.id as string,
        kind,
        name: typeof t.name === 'string' ? t.name : TOOL_LABELS[kind],
        inputParts: parseStoredTimeParts(t.inputParts, defaultInput),
        breakInputParts: parseStoredTimeParts(t.breakInputParts, DEFAULT_POMODORO_BREAK_INPUT),
        sessionsInput:
          typeof t.sessionsInput === 'string' && /^\d{1,2}$/.test(t.sessionsInput)
            ? t.sessionsInput
            : DEFAULT_POMODORO_SESSIONS,
      }
    })

  return { tiles }
}

const store = createLocalPreferenceStore({
  key: DASHBOARD_STORAGE_KEY,
  defaults: DEFAULTS,
  parse: parseDashboardPreferences,
})

export function loadDashboardPreferences(): DashboardPreferences {
  return store.load()
}

export function saveDashboardPreferences(prefs: DashboardPreferences): void {
  store.save(prefs)
}

export function saveDashboardPreferencesSync(prefs: DashboardPreferences): void {
  store.saveSync(prefs)
}

let tileCounter = 0

export function createDefaultTileConfig(kind: ToolKind): DashboardTileConfig {
  const defaultInput = kind === 'pomodoro'
    ? DEFAULT_POMODORO_INPUT
    : kind === 'timer'
      ? '00:00:00'
      : DEFAULT_COUNTDOWN_INPUT

  return {
    id: `tile-${Date.now()}-${++tileCounter}`,
    kind,
    name: TOOL_LABELS[kind],
    inputParts: splitTimeParts(defaultInput),
    breakInputParts: splitTimeParts(DEFAULT_POMODORO_BREAK_INPUT),
    sessionsInput: DEFAULT_POMODORO_SESSIONS,
  }
}
