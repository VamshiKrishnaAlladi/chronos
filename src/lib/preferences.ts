import type { AppView, StoredPreferences, ToolKind } from '../types'
import { splitTimeParts, parseStoredTimeParts } from './time'
import { createLocalPreferenceStore } from './localPreferenceStore'
import {
  DEFAULT_COUNTDOWN_INPUT,
  DEFAULT_POMODORO_BREAK_INPUT,
  DEFAULT_POMODORO_INPUT,
  DEFAULT_POMODORO_SESSIONS,
  DEFAULT_SOUND_VOLUME,
} from './defaults'

const PREFERENCES_STORAGE_KEY = 'chronos-preferences-v1'

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
}

export function parseStoredPreferences(value: unknown): StoredPreferences {
  const parsed = value as Partial<StoredPreferences> & { soundMuted?: boolean }

  const activeTool: ToolKind =
    parsed.activeTool === 'timer'
      ? 'timer'
      : parsed.activeTool === 'pomodoro'
        ? 'pomodoro'
        : 'countdown'

  const appView: AppView = parsed.appView === 'dashboard' ? 'dashboard' : 'focus'

  const pomoSessionsInput =
    typeof parsed.pomoSessionsInput === 'string' && /^\d{1,2}$/.test(parsed.pomoSessionsInput)
      ? parsed.pomoSessionsInput
      : DEFAULT_POMODORO_SESSIONS

  return {
    activeTool,
    appView,
    countdownInputParts: parseStoredTimeParts(parsed.countdownInputParts, DEFAULT_COUNTDOWN_INPUT),
    pomodoroInputParts: parseStoredTimeParts(parsed.pomodoroInputParts, DEFAULT_POMODORO_INPUT),
    pomoBreakInputParts: parseStoredTimeParts(parsed.pomoBreakInputParts, DEFAULT_POMODORO_BREAK_INPUT),
    pomoSessionsInput,
    soundVolume: parseStoredVolume(parsed.soundVolume, parsed.soundMuted),
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
