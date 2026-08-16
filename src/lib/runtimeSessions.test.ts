import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CountdownState, PomodoroState, TimerState } from '../types'
import { createCountdownState } from '../timers/countdownReducer'
import { createSplitTimerState } from '../timers/splitTimerReducer'
import { createPomodoroState } from '../timers/pomodoroReducer'
import {
  RUNTIME_SESSIONS_VERSION,
  clearRuntimeSession,
  dashboardRuntimeSessionId,
  focusRuntimeSessionId,
  loadCountdownRuntimeSession,
  loadPomodoroRuntimeSession,
  loadTimerRuntimeSession,
  saveRuntimeSession,
} from './runtimeSessions'

const STORAGE_KEY = 'chronos-runtime-sessions-v1'

const countdownFallback = createCountdownState(25_000)
const timerFallback = createSplitTimerState()
const pomodoroFallback = createPomodoroState({
  workDurationMs: 25_000,
  breakMs: 5_000,
  sessionsPerCycle: 4,
})

describe('runtime session persistence', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('restores a running countdown from its absolute end time', () => {
    const state: CountdownState = {
      durationMs: 10_000,
      remainingMs: 9_000,
      overrunMs: 0,
      endsAt: 20_000,
      status: 'running',
      completedAt: null,
      alertedAt: null,
    }
    const id = focusRuntimeSessionId('countdown')
    saveRuntimeSession(id, 'countdown', state)

    expect(loadCountdownRuntimeSession(id, countdownFallback, 15_250)).toEqual({
      ...state,
      remainingMs: 5_000,
    })
  })

  it('restores paused and completed countdowns without turning saved display ticks into truth', () => {
    const id = focusRuntimeSessionId('countdown')
    const paused: CountdownState = {
      durationMs: 10_000,
      remainingMs: 6_000,
      overrunMs: 0,
      endsAt: null,
      status: 'paused',
      completedAt: null,
      alertedAt: null,
    }
    saveRuntimeSession(id, 'countdown', paused)
    expect(loadCountdownRuntimeSession(id, countdownFallback, 90_000)).toEqual(paused)

    const done: CountdownState = {
      ...paused,
      remainingMs: 0,
      overrunMs: 1_000,
      status: 'done',
      completedAt: 20_000,
      alertedAt: 20_000,
    }
    saveRuntimeSession(id, 'countdown', done)
    expect(loadCountdownRuntimeSession(id, countdownFallback, 24_900)).toEqual({
      ...done,
      overrunMs: 4_000,
    })
  })

  it('restores an expired running countdown as done at the exact end time', () => {
    const id = focusRuntimeSessionId('countdown')
    saveRuntimeSession(id, 'countdown', {
      durationMs: 10_000,
      remainingMs: 8_000,
      overrunMs: 0,
      endsAt: 20_000,
      status: 'running',
      completedAt: null,
      alertedAt: null,
    })

    expect(loadCountdownRuntimeSession(id, countdownFallback, 25_900)).toEqual({
      durationMs: 10_000,
      remainingMs: 0,
      overrunMs: 5_000,
      endsAt: null,
      status: 'done',
      completedAt: 20_000,
      alertedAt: null,
    })
  })

  it('derives a running split timer from startedAt and preserves paused elapsed time and splits', () => {
    const id = focusRuntimeSessionId('timer')
    const running: TimerState = {
      mainElapsedMs: 100,
      startedAt: 10_000,
      status: 'running',
      splits: [
        { cumulativeMs: 1_200, splitMs: 1_200 },
        { cumulativeMs: 2_000, splitMs: 800 },
      ],
    }
    saveRuntimeSession(id, 'timer', running)
    expect(loadTimerRuntimeSession(id, timerFallback, 13_500)).toEqual({
      ...running,
      mainElapsedMs: 3_500,
    })

    const paused: TimerState = { ...running, mainElapsedMs: 2_500, startedAt: null, status: 'paused' }
    saveRuntimeSession(id, 'timer', paused)
    expect(loadTimerRuntimeSession(id, timerFallback, 99_000)).toEqual(paused)
  })

  it('restores pomodoro phase/session state and expires against endsAt', () => {
    const id = focusRuntimeSessionId('pomodoro')
    const runningBreak: PomodoroState = {
      workDurationMs: 25_000,
      breakMs: 5_000,
      sessionsPerCycle: 4,
      currentPhase: 'break',
      currentSession: 2,
      remainingMs: 4_000,
      endsAt: 20_000,
      status: 'running',
      completedAt: null,
      alertedAt: null,
    }
    saveRuntimeSession(id, 'pomodoro', runningBreak)
    expect(loadPomodoroRuntimeSession(id, pomodoroFallback, 17_100)).toEqual({
      ...runningBreak,
      remainingMs: 3_000,
    })
    expect(loadPomodoroRuntimeSession(id, pomodoroFallback, 23_000)).toEqual({
      ...runningBreak,
      remainingMs: 0,
      endsAt: null,
      status: 'done',
      completedAt: 20_000,
    })

    const paused: PomodoroState = {
      ...runningBreak,
      remainingMs: 2_500,
      endsAt: null,
      status: 'paused',
    }
    saveRuntimeSession(id, 'pomodoro', paused)
    expect(loadPomodoroRuntimeSession(id, pomodoroFallback, 99_000)).toEqual(paused)
  })

  it('maps dashboard state by tile id and rejects stale tool kinds', () => {
    const first = dashboardRuntimeSessionId('tile-a')
    const second = dashboardRuntimeSessionId('tile-b')
    const firstState: CountdownState = {
      durationMs: 8_000,
      remainingMs: 8_000,
      overrunMs: 0,
      endsAt: null,
      status: 'paused',
      completedAt: null,
      alertedAt: null,
    }
    const secondState: TimerState = {
      mainElapsedMs: 4_000,
      startedAt: null,
      status: 'paused',
      splits: [],
    }
    saveRuntimeSession(first, 'countdown', firstState)
    saveRuntimeSession(second, 'timer', secondState)

    expect(loadCountdownRuntimeSession(first, countdownFallback, 0)).toEqual(firstState)
    expect(loadTimerRuntimeSession(second, timerFallback, 0)).toEqual(secondState)
    expect(loadTimerRuntimeSession(first, timerFallback, 0)).toBe(timerFallback)

    clearRuntimeSession(first)
    expect(loadCountdownRuntimeSession(first, countdownFallback, 0)).toBe(countdownFallback)
    expect(loadTimerRuntimeSession(second, timerFallback, 0)).toEqual(secondState)
  })

  it('clears idle sessions so preferences remain the source of configuration defaults', () => {
    const id = focusRuntimeSessionId('countdown')
    const running: CountdownState = {
      durationMs: 10_000,
      remainingMs: 5_000,
      overrunMs: 0,
      endsAt: 20_000,
      status: 'running',
      completedAt: null,
      alertedAt: null,
    }
    saveRuntimeSession(id, 'countdown', running)
    saveRuntimeSession(id, 'countdown', createCountdownState(30_000))

    expect(loadCountdownRuntimeSession(id, countdownFallback, 0)).toBe(countdownFallback)
  })

  it('falls back safely for corrupt data, unknown versions, and invalid session shapes', () => {
    window.localStorage.setItem(STORAGE_KEY, '{')
    expect(loadCountdownRuntimeSession('focus:countdown', countdownFallback, 0)).toBe(countdownFallback)

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: RUNTIME_SESSIONS_VERSION + 1,
      sessions: {},
    }))
    expect(loadTimerRuntimeSession('focus:timer', timerFallback, 0)).toBe(timerFallback)

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: RUNTIME_SESSIONS_VERSION,
      sessions: {
        'focus:pomodoro': {
          kind: 'pomodoro',
          state: { status: 'running', endsAt: 'tomorrow' },
        },
      },
    }))
    expect(loadPomodoroRuntimeSession('focus:pomodoro', pomodoroFallback, 0)).toBe(pomodoroFallback)
  })

  it('loads the legacy unversioned runtime shape and rejects invalid writes', () => {
    const id = focusRuntimeSessionId('countdown')
    const paused: CountdownState = {
      durationMs: 10_000,
      remainingMs: 5_000,
      overrunMs: 0,
      endsAt: null,
      status: 'paused',
      completedAt: null,
      alertedAt: null,
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      sessions: { [id]: { kind: 'countdown', state: paused } },
    }))
    expect(loadCountdownRuntimeSession(id, countdownFallback, 0)).toEqual(paused)

    saveRuntimeSession(id, 'countdown', { ...paused, durationMs: 360_000_000 })
    expect(loadCountdownRuntimeSession(id, countdownFallback, 0)).toEqual(paused)
  })

  it('continues from memory when storage writes and removal are unavailable', () => {
    const id = focusRuntimeSessionId('countdown')
    const paused: CountdownState = {
      durationMs: 10_000,
      remainingMs: 5_000,
      overrunMs: 0,
      endsAt: null,
      status: 'paused',
      completedAt: null,
      alertedAt: null,
    }
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Full', 'QuotaExceededError')
    })
    expect(() => saveRuntimeSession(id, 'countdown', paused)).not.toThrow()
    saveRuntimeSession(id, 'countdown', paused)
    expect(setItem).toHaveBeenCalledTimes(1)
    expect(loadCountdownRuntimeSession(id, countdownFallback, 0)).toEqual(paused)
    setItem.mockRestore()

    const removeItem = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError')
    })
    expect(() => clearRuntimeSession(id)).not.toThrow()
    expect(loadCountdownRuntimeSession(id, countdownFallback, 0)).toBe(countdownFallback)
    removeItem.mockRestore()
  })
})
