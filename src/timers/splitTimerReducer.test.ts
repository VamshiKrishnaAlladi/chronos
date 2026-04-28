import { describe, expect, it } from 'vitest'
import { createSplitTimerState, reduceSplitTimer } from './splitTimerReducer'

describe('split timer reducer', () => {
  it('tracks elapsed time across pause and resume', () => {
    const running = reduceSplitTimer(createSplitTimerState(), { type: 'start', now: 1000 })
    const paused = reduceSplitTimer(running, { type: 'pause', now: 2500 })
    const resumed = reduceSplitTimer(paused, { type: 'resume', now: 4000 })
    const ticked = reduceSplitTimer(resumed, { type: 'tick', now: 4500 })

    expect(paused.mainElapsedMs).toBe(1500)
    expect(resumed.startedAt).toBe(2500)
    expect(ticked.mainElapsedMs).toBe(2000)
  })

  it('records cumulative and split durations', () => {
    const running = reduceSplitTimer(createSplitTimerState(), { type: 'start', now: 1000 })
    const first = reduceSplitTimer(running, { type: 'split', now: 1800 })
    const second = reduceSplitTimer(first, { type: 'split', now: 2500 })

    expect(second.splits).toEqual([
      { cumulativeMs: 800, splitMs: 800 },
      { cumulativeMs: 1500, splitMs: 700 },
    ])
  })
})
