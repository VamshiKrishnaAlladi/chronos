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
import {
  createVersionedPayload,
  isRecord,
  parseSessionsInput,
  parseStorageId,
  parseTileName,
  parseVersionedPayload,
} from './persistenceSchema'

const DASHBOARD_STORAGE_KEY = 'chronos-dashboard-v1'
export const DASHBOARD_PREFERENCES_VERSION = 1

export interface DashboardPreferences {
  tiles: DashboardTileConfig[]
}

const DEFAULTS: DashboardPreferences = { tiles: [] }

export function parseDashboardPreferences(value: unknown): DashboardPreferences {
  const payload = parseVersionedPayload(value, DASHBOARD_PREFERENCES_VERSION)
  if (!payload.supported || !isRecord(payload.data) || !Array.isArray(payload.data.tiles)) {
    return { ...DEFAULTS }
  }

  const validKinds = ['countdown', 'timer', 'pomodoro']
  const seenIds = new Set<string>()
  const tiles: DashboardTileConfig[] = []

  for (const candidate of payload.data.tiles) {
    if (tiles.length >= 4 || !isRecord(candidate) || !validKinds.includes(candidate.kind as string)) {
      continue
    }
    const id = parseStorageId(candidate.id)
    if (!id || seenIds.has(id)) continue
    seenIds.add(id)

    const kind = candidate.kind as ToolKind
    const defaultInput = kind === 'pomodoro'
      ? DEFAULT_POMODORO_INPUT
      : kind === 'timer'
        ? '00:00:00'
        : DEFAULT_COUNTDOWN_INPUT

    tiles.push({
      id,
      kind,
      name: parseTileName(candidate.name, TOOL_LABELS[kind]),
      inputParts: parseStoredTimeParts(candidate.inputParts, defaultInput),
      breakInputParts: parseStoredTimeParts(candidate.breakInputParts, DEFAULT_POMODORO_BREAK_INPUT),
      sessionsInput: parseSessionsInput(candidate.sessionsInput, DEFAULT_POMODORO_SESSIONS),
    })
  }

  return { tiles }
}

const store = createLocalPreferenceStore({
  key: DASHBOARD_STORAGE_KEY,
  defaults: DEFAULTS,
  parse: parseDashboardPreferences,
  serialize: (value) => createVersionedPayload(DASHBOARD_PREFERENCES_VERSION, value),
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

function createTileId(): string {
  try {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
      return `tile-${globalThis.crypto.randomUUID()}`
    }
  } catch {
    // Continue with the monotonic fallback when the platform implementation fails.
  }

  tileCounter += 1
  return `tile-${Date.now().toString(36)}-${tileCounter.toString(36)}`
}

export function createDefaultTileConfig(kind: ToolKind): DashboardTileConfig {
  const defaultInput = kind === 'pomodoro'
    ? DEFAULT_POMODORO_INPUT
    : kind === 'timer'
      ? '00:00:00'
      : DEFAULT_COUNTDOWN_INPUT

  return {
    id: createTileId(),
    kind,
    name: TOOL_LABELS[kind],
    inputParts: splitTimeParts(defaultInput),
    breakInputParts: splitTimeParts(DEFAULT_POMODORO_BREAK_INPUT),
    sessionsInput: DEFAULT_POMODORO_SESSIONS,
  }
}
