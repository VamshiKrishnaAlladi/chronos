import { useCallback, useRef, useState, type RefObject } from 'react'
import type { TimeParts, TimePartKey, TimerState, ToolFace } from '../types'
import {
  normalizeTimeParts,
  timePartsToMs,
  isValidTimeParts,
  padTimePart,
  formatClockTime,
} from '../lib/time'
import { primeAudio, stopCompletionTone } from '../lib/notifications'
import { useTickInterval } from './useTickInterval'
import { useAlertEffect } from './useAlertEffect'

export interface UseTimerReturn extends ToolFace {
  state: TimerState
  inputParts: TimeParts
  inputRefs: Record<TimePartKey, RefObject<HTMLInputElement | null>>
  setInputPart: (part: TimePartKey, value: string) => void
  padInputPart: (part: TimePartKey) => void
}

export function useTimer(initialInputParts: TimeParts): UseTimerReturn {
  const [state, setState] = useState<TimerState>(() => ({
    targetMs: timePartsToMs(normalizeTimeParts(initialInputParts)),
    mainElapsedMs: 0,
    startedAt: null,
    status: 'idle',
    targetReachedAt: null,
    alertedAt: null,
  }))
  const [inputParts, setInputParts] = useState<TimeParts>(initialInputParts)

  const inputRefs: Record<TimePartKey, RefObject<HTMLInputElement | null>> = {
    hours: useRef<HTMLInputElement>(null),
    minutes: useRef<HTMLInputElement>(null),
    seconds: useRef<HTMLInputElement>(null),
  }

  const parsedInputMs = timePartsToMs(normalizeTimeParts(inputParts))
  const inputInvalid = !isValidTimeParts(inputParts) || parsedInputMs === 0
  const inputDisabled = state.status === 'running' || state.status === 'paused'
  const displayMs = state.status === 'idle' ? 0 : state.mainElapsedMs
  const readoutBlinking = state.targetReachedAt !== null

  const progress =
    state.status === 'idle' || state.targetMs <= 0
      ? 0
      : Math.min(Math.round((state.mainElapsedMs / state.targetMs) * 100), 100)

  let statusCopy: string
  if (state.status === 'idle') {
    statusCopy = 'Ready'
  } else if (state.targetReachedAt !== null) {
    statusCopy = `Alerted ${formatClockTime(state.targetReachedAt)}`
  } else if (state.status === 'running' && state.startedAt !== null) {
    statusCopy = `Alerts ${formatClockTime(state.startedAt + state.targetMs)}`
  } else if (state.status === 'paused') {
    statusCopy = 'Paused'
  } else {
    statusCopy = 'Running'
  }

  useTickInterval(
    state.status === 'running' && state.startedAt !== null,
    (now) => {
      setState((prev) => {
        if (prev.status !== 'running' || prev.startedAt === null) return prev

        const mainElapsedMs =
          Math.max(Math.floor((now - prev.startedAt) / 1000), 0) * 1000
        const reachedTarget =
          prev.targetReachedAt === null &&
          prev.targetMs > 0 &&
          mainElapsedMs >= prev.targetMs

        if (!reachedTarget && mainElapsedMs === prev.mainElapsedMs) return prev

        if (reachedTarget) {
          return {
            ...prev,
            mainElapsedMs,
            targetReachedAt: prev.startedAt + prev.targetMs,
            alertedAt: null,
          }
        }

        return { ...prev, mainElapsedMs }
      })
    },
    [state.startedAt],
  )

  useAlertEffect(
    state.targetReachedAt !== null && state.alertedAt !== state.targetReachedAt,
    () => {
      setState((prev) =>
        prev.targetReachedAt !== null && prev.alertedAt !== prev.targetReachedAt
          ? { ...prev, alertedAt: prev.targetReachedAt }
          : prev,
      )
    },
    [state.targetReachedAt, state.alertedAt],
  )

  const start = useCallback(() => {
    stopCompletionTone()

    const nextParts = normalizeTimeParts(inputParts)
    setInputParts(nextParts)

    const nextTargetMs = timePartsToMs(nextParts)
    if (!isValidTimeParts(nextParts) || nextTargetMs === 0) return

    void (async () => {
      await primeAudio()
      const now = Date.now()

      setState({
        targetMs: nextTargetMs,
        mainElapsedMs: 0,
        startedAt: now,
        status: 'running',
        targetReachedAt: null,
        alertedAt: null,
      })
    })()
  }, [inputParts])

  const pause = useCallback(() => {
    stopCompletionTone()
    const now = Date.now()

    setState((prev) => {
      if (prev.status !== 'running' || prev.startedAt === null) return prev

      return {
        ...prev,
        mainElapsedMs:
          Math.max(Math.floor((now - prev.startedAt) / 1000), 0) * 1000,
        startedAt: null,
        status: 'paused',
      }
    })
  }, [])

  const resume = useCallback(() => {
    stopCompletionTone()

    void (async () => {
      await primeAudio()
      const now = Date.now()

      setState((prev) => {
        if (prev.status !== 'paused') return prev
        return {
          ...prev,
          startedAt: now - prev.mainElapsedMs,
          status: 'running',
        }
      })
    })()
  }, [])

  const stop = useCallback(() => {
    stopCompletionTone()

    setState({
      targetMs: parsedInputMs,
      mainElapsedMs: 0,
      startedAt: null,
      status: 'idle',
      targetReachedAt: null,
      alertedAt: null,
    })
  }, [parsedInputMs])

  const setInputPart = useCallback((part: TimePartKey, value: string) => {
    setInputParts((prev) => ({ ...prev, [part]: value }))
  }, [])

  const padInputPart = useCallback((part: TimePartKey) => {
    setInputParts((prev) => ({ ...prev, [part]: padTimePart(prev[part]) }))
  }, [])

  return {
    state,
    inputParts,
    inputRefs,
    setInputPart,
    padInputPart,
    displayMs,
    status: state.status,
    statusCopy,
    progress,
    readoutBlinking,
    inputInvalid,
    inputDisabled,
    restartLabel: 'Restart',
    start,
    pause,
    resume,
    stop,
  }
}
