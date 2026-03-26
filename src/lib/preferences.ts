import type { AppView, StoredPreferences, ToolKind } from '../types'
import { splitTimeParts, parseStoredTimeParts } from './time'

const PREFERENCES_STORAGE_KEY = 'chronos-preferences-v1'

export const DEFAULT_COUNTDOWN_INPUT = '00:25:00'
export const DEFAULT_POMODORO_INPUT = '00:25:00'
export const DEFAULT_POMODORO_BREAK_INPUT = '00:05:00'
export const DEFAULT_POMODORO_SESSIONS = '4'

const DEFAULTS: StoredPreferences = {
  activeTool: 'countdown',
  appView: 'focus',
  countdownInputParts: splitTimeParts(DEFAULT_COUNTDOWN_INPUT),
  pomodoroInputParts: splitTimeParts(DEFAULT_POMODORO_INPUT),
  pomoBreakInputParts: splitTimeParts(DEFAULT_POMODORO_BREAK_INPUT),
  pomoSessionsInput: DEFAULT_POMODORO_SESSIONS,
  soundMuted: false,
}

export function loadStoredPreferences(): StoredPreferences {
  if (typeof window === 'undefined') {
    return DEFAULTS
  }

  const storedValue = window.localStorage.getItem(PREFERENCES_STORAGE_KEY)
  if (!storedValue) {
    return DEFAULTS
  }

  try {
    const parsed = JSON.parse(storedValue) as Partial<StoredPreferences>

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
      soundMuted: parsed.soundMuted === true,
    }
  } catch {
    return DEFAULTS
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

export function saveStoredPreferences(preferences: StoredPreferences): void {
  if (typeof window === 'undefined') {
    return
  }

  if (saveTimer) {
    clearTimeout(saveTimer)
  }

  saveTimer = setTimeout(() => {
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences))
    saveTimer = null
  }, 400)
}

export function saveStoredPreferencesSync(preferences: StoredPreferences): void {
  if (typeof window === 'undefined') return
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences))
}
