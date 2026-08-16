import type { AppView, StoredPreferences, ToolKind } from '../types'
import { splitTimeParts, parseStoredTimeParts } from './time'
import { createLocalPreferenceStore } from './localPreferenceStore'
import {
  createVersionedPayload,
  isRecord,
  parseSessionsInput,
  parseVersionedPayload,
} from './persistenceSchema'
import {
  DEFAULT_COUNTDOWN_INPUT,
  DEFAULT_POMODORO_BREAK_INPUT,
  DEFAULT_POMODORO_INPUT,
  DEFAULT_POMODORO_SESSIONS,
  DEFAULT_SOUND_VOLUME,
} from './defaults'

const PREFERENCES_STORAGE_KEY = 'chronos-preferences-v1'
export const PREFERENCES_VERSION = 1

export {
  DEFAULT_COUNTDOWN_INPUT,
  DEFAULT_POMODORO_BREAK_INPUT,
  DEFAULT_POMODORO_INPUT,
  DEFAULT_POMODORO_SESSIONS,
}

const DEFAULTS: StoredPreferences = {
  activeTool: 'countdown',
  appView: 'focus',
  countdownInputParts: splitTimeParts(DEFAULT_COUNTDOWN_INPUT),
  pomodoroInputParts: splitTimeParts(DEFAULT_POMODORO_INPUT),
  pomoBreakInputParts: splitTimeParts(DEFAULT_POMODORO_BREAK_INPUT),
  pomoSessionsInput: DEFAULT_POMODORO_SESSIONS,
  soundVolume: DEFAULT_SOUND_VOLUME,
  keepAwake: false,
}

export function parseStoredPreferences(value: unknown): StoredPreferences {
  const payload = parseVersionedPayload(value, PREFERENCES_VERSION)
  if (!payload.supported || !isRecord(payload.data)) return { ...DEFAULTS }
  const parsed = payload.data as Partial<StoredPreferences> & { soundMuted?: boolean }

  const activeTool: ToolKind =
    parsed.activeTool === 'timer'
      ? 'timer'
      : parsed.activeTool === 'pomodoro'
        ? 'pomodoro'
        : 'countdown'

  const appView: AppView = parsed.appView === 'dashboard' ? 'dashboard' : 'focus'

  const pomoSessionsInput = parseSessionsInput(parsed.pomoSessionsInput, DEFAULT_POMODORO_SESSIONS)

  return {
    activeTool,
    appView,
    countdownInputParts: parseStoredTimeParts(parsed.countdownInputParts, DEFAULT_COUNTDOWN_INPUT),
    pomodoroInputParts: parseStoredTimeParts(parsed.pomodoroInputParts, DEFAULT_POMODORO_INPUT),
    pomoBreakInputParts: parseStoredTimeParts(parsed.pomoBreakInputParts, DEFAULT_POMODORO_BREAK_INPUT),
    pomoSessionsInput,
    soundVolume: parseStoredVolume(parsed.soundVolume, parsed.soundMuted),
    keepAwake: parsed.keepAwake === true,
  }
}

function parseStoredVolume(raw: unknown, legacyMuted?: boolean): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const clamped = Math.max(0, Math.min(100, Math.round(raw / 10) * 10))
    return clamped
  }
  if (legacyMuted === true) return 0
  return DEFAULTS.soundVolume
}

const store = createLocalPreferenceStore({
  key: PREFERENCES_STORAGE_KEY,
  defaults: DEFAULTS,
  parse: parseStoredPreferences,
  serialize: (value) => createVersionedPayload(PREFERENCES_VERSION, value),
})

export function saveStoredPreferences(preferences: StoredPreferences): void {
  store.save(preferences)
}

export function saveStoredPreferencesSync(preferences: StoredPreferences): void {
  store.saveSync(preferences)
}

export function loadStoredPreferences(): StoredPreferences {
  return store.load()
}
