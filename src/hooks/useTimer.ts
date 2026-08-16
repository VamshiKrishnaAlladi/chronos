import { useCallback, useEffect, useRef } from 'react'
import type { TimerState, ToolFace } from '../types'
import { formatClockTime } from '../lib/time'
import { createSplitTimerState, reduceSplitTimer } from '../timers/splitTimerReducer'
import { focusRuntimeSessionId, loadTimerRuntimeSession } from '../lib/runtimeSessions'
import { useRuntimeSessionState } from './useRuntimeSessionState'

export interface UseTimerReturn extends ToolFace {
  state: TimerState
  split: () => void
}

export function useTimer(
  runtimeSessionId = focusRuntimeSessionId('timer'),
): UseTimerReturn {
  const [state, setState] = useRuntimeSessionState<TimerState>(runtimeSessionId, 'timer', () =>
    loadTimerRuntimeSession(runtimeSessionId, createSplitTimerState()),
  )

  const rafRef = useRef<number>(0)

  useEffect(() => {
    if (state.status !== 'running' || state.startedAt === null) return

    function tick() {
      setState((prev) => reduceSplitTimer(prev, { type: 'tick', now: Date.now() }), false)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [state.status, state.startedAt, setState])

  const displayMs = state.mainElapsedMs
  const readoutBlinking = false

  let statusCopy: string
  if (state.status === 'idle') {
    statusCopy = 'Ready'
  } else if (state.status === 'running' && state.startedAt !== null) {
    statusCopy = `Started ${formatClockTime(state.startedAt)}`
  } else if (state.status === 'paused') {
    statusCopy = 'Paused'
  } else {
    statusCopy = 'Running'
  }

  const start = useCallback(() => {
    setState((prev) => reduceSplitTimer(prev, { type: 'start', now: Date.now() }))
  }, [setState])

  const pause = useCallback(() => {
    setState((prev) => reduceSplitTimer(prev, { type: 'pause', now: Date.now() }))
  }, [setState])

  const resume = useCallback(() => {
    setState((prev) => reduceSplitTimer(prev, { type: 'resume', now: Date.now() }))
  }, [setState])

  const stop = useCallback(() => {
    setState((prev) => reduceSplitTimer(prev, { type: 'stop' }))
  }, [setState])

  const split = useCallback(() => {
    setState((prev) => reduceSplitTimer(prev, { type: 'split', now: Date.now() }))
  }, [setState])

  return {
    state,
    displayMs,
    status: state.status,
    statusCopy,
    progress: 0,
    readoutBlinking,
    inputInvalid: false,
    inputDisabled: true,
    restartLabel: 'Restart',
    split,
    start,
    pause,
    resume,
    stop,
  }
}
