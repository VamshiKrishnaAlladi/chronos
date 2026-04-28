import { describe, expect, it } from 'vitest'
import { createCountdownState, reduceCountdown } from './countdownReducer'

describe('countdown reducer', () => {
  it('counts down to done and tracks overrun time', () => {
    const running = reduceCountdown(createCountdownState(5000), {
      type: 'start',
      durationMs: 5000,
      now: 1000,
    })

    const done = reduceCountdown(running, { type: 'tick', now: 6000 })
    expect(done.status).toBe('done')
    expect(done.remainingMs).toBe(0)
    expect(done.completedAt).toBe(6000)

    const overrun = reduceCountdown(done, { type: 'tickOverrun', now: 8200 })
    expect(overrun.overrunMs).toBe(2000)
  })

  it('pauses and resumes with preserved remaining time', () => {
    const running = reduceCountdown(createCountdownState(5000), {
      type: 'start',
      durationMs: 5000,
      now: 1000,
    })

    const paused = reduceCountdown(running, { type: 'pause', now: 2500 })
    expect(paused.status).toBe('paused')
    expect(paused.remainingMs).toBe(4000)

    const resumed = reduceCountdown(paused, { type: 'resume', now: 4000 })
    expect(resumed.status).toBe('running')
    expect(resumed.endsAt).toBe(8000)
  })
})
