import { useCallback, useEffect, useRef, useState } from 'react'
import type { TimerState, ToolFace } from '../types'
import { formatClockTime } from '../lib/time'

export interface UseTimerReturn extends ToolFace {
  state: TimerState
  split: () => void
}

export function useTimer(): UseTimerReturn {
  const [state, setState] = useState<TimerState>({
    mainElapsedMs: 0,
    startedAt: null,
    status: 'idle',
    splits: [],
  })

  const rafRef = useRef<number>(0)

  useEffect(() => {
    if (state.status !== 'running' || state.startedAt === null) return

    const origin = state.startedAt
    function tick() {
      setState((prev) => {
        if (prev.status !== 'running' || prev.startedAt === null) return prev
        return { ...prev, mainElapsedMs: Math.max(Date.now() - origin, 0) }
      })
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
    const now = Date.now()
    setState({
      mainElapsedMs: 0,
      startedAt: now,
      status: 'running',
      splits: [],
    })
  }, [])

  const pause = useCallback(() => {
    const now = Date.now()
    setState((prev) => {
      if (prev.status !== 'running' || prev.startedAt === null) return prev
      return {
        ...prev,
        mainElapsedMs: Math.max(now - prev.startedAt, 0),
        startedAt: null,
        status: 'paused',
      }
    })
  }, [])

  const resume = useCallback(() => {
    const now = Date.now()
    setState((prev) => {
      if (prev.status !== 'paused') return prev
      return {
        ...prev,
        startedAt: now - prev.mainElapsedMs,
        status: 'running',
      }
    })
  }, [])

  const stop = useCallback(() => {
    setState({
      mainElapsedMs: 0,
      startedAt: null,
      status: 'idle',
      splits: [],
    })
  }, [])

  const split = useCallback(() => {
    const now = Date.now()
    setState((prev) => {
      if (prev.status !== 'running' || prev.startedAt === null) return prev
      const cumulativeMs = Math.max(now - prev.startedAt, 0)
      const lastCumulative =
        prev.splits.length > 0
          ? prev.splits[prev.splits.length - 1].cumulativeMs
          : 0
      return {
        ...prev,
        splits: [
          ...prev.splits,
          { cumulativeMs, splitMs: cumulativeMs - lastCumulative },
        ],
      }
    })
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
