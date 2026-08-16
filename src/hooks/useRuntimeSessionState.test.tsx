import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSplitTimerState, reduceSplitTimer } from '../timers/splitTimerReducer'
import { loadTimerRuntimeSession } from '../lib/runtimeSessions'
import { useRuntimeSessionState } from './useRuntimeSessionState'

const SESSION_ID = 'test:timer'

describe('useRuntimeSessionState', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  it('persists explicit transitions and keeps visual ticks in memory', () => {
    const { result } = renderHook(() => useRuntimeSessionState(
      SESSION_ID,
      'timer',
      createSplitTimerState,
    ))
    const setItem = vi.spyOn(Storage.prototype, 'setItem')

    act(() => {
      result.current[1]((state) => reduceSplitTimer(state, { type: 'start', now: 1_000 }))
    })
    expect(setItem).toHaveBeenCalledTimes(1)

    setItem.mockClear()
    act(() => {
      result.current[1]((state) => reduceSplitTimer(state, { type: 'tick', now: 2_000 }), false)
      result.current[1]((state) => reduceSplitTimer(state, { type: 'tick', now: 3_000 }), false)
    })
    expect(result.current[0].mainElapsedMs).toBe(2_000)
    expect(setItem).not.toHaveBeenCalled()
  })

  it('flushes the latest in-memory value when the page becomes hidden', () => {
    const { result } = renderHook(() => useRuntimeSessionState(
      SESSION_ID,
      'timer',
      createSplitTimerState,
    ))
    act(() => {
      result.current[1]((state) => reduceSplitTimer(state, { type: 'start', now: 1_000 }))
      result.current[1]((state) => reduceSplitTimer(state, { type: 'tick', now: 4_000 }), false)
    })

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    act(() => document.dispatchEvent(new Event('visibilitychange')))

    expect(loadTimerRuntimeSession(SESSION_ID, createSplitTimerState(), 5_000)).toEqual({
      mainElapsedMs: 4_000,
      startedAt: 1_000,
      status: 'running',
      splits: [],
    })
  })
})
