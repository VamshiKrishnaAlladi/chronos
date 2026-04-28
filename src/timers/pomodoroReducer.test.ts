import { describe, expect, it } from 'vitest'
import { createPomodoroState, reducePomodoro } from './pomodoroReducer'

const config = {
  workDurationMs: 1500,
  breakMs: 500,
  sessionsPerCycle: 2,
}

describe('pomodoro reducer', () => {
  it('advances from work to break after a completed work session', () => {
    const running = reducePomodoro(createPomodoroState(config), {
      type: 'start',
      config,
      now: 1000,
    })

    const done = reducePomodoro(running, { type: 'tick', now: 2500 })
    const next = reducePomodoro(done, { type: 'start', config, now: 3000 })

    expect(next.status).toBe('running')
    expect(next.currentPhase).toBe('break')
    expect(next.currentSession).toBe(1)
    expect(next.remainingMs).toBe(500)
  })

  it('starts a new cycle after final work session completes', () => {
    const state = {
      ...createPomodoroState(config),
      currentSession: 2,
      status: 'done' as const,
      completedAt: 2000,
    }

    const next = reducePomodoro(state, { type: 'start', config, now: 3000 })

    expect(next.currentPhase).toBe('work')
    expect(next.currentSession).toBe(1)
    expect(next.remainingMs).toBe(1500)
    expect(next.endsAt).toBe(4500)
  })
})
