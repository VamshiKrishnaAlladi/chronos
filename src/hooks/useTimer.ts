import { useCallback, useEffect, useRef, useState } from 'react'
import type { TimerState, ToolFace } from '../types'
import { formatClockTime } from '../lib/time'
import { createSplitTimerState, reduceSplitTimer } from '../timers/splitTimerReducer'

export interface UseTimerReturn extends ToolFace {
  state: TimerState
  split: () => void
}

export function useTimer(): UseTimerReturn {
  const [state, setState] = useState<TimerState>(() => createSplitTimerState())

  const rafRef = useRef<number>(0)

  useEffect(() => {
    if (state.status !== 'running' || state.startedAt === null) return

    function tick() {
      setState((prev) => reduceSplitTimer(prev, { type: 'tick', now: Date.now() }))
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [state.status, state.startedAt])

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
  }, [])

  const pause = useCallback(() => {
    setState((prev) => reduceSplitTimer(prev, { type: 'pause', now: Date.now() }))
  }, [])

  const resume = useCallback(() => {
    setState((prev) => reduceSplitTimer(prev, { type: 'resume', now: Date.now() }))
  }, [])

  const stop = useCallback(() => {
    setState((prev) => reduceSplitTimer(prev, { type: 'stop' }))
  }, [])

  const split = useCallback(() => {
    setState((prev) => reduceSplitTimer(prev, { type: 'split', now: Date.now() }))
  }, [])

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
