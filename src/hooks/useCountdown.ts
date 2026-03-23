import { useState, useRef, useCallback, type RefObject } from 'react'
import type { CountdownState, TimeParts, TimePartKey, ToolFace } from '../types'
import {
  normalizeTimeParts,
  timePartsToMs,
  isValidTimeParts,
  formatClockTime,
  padTimePart,
} from '../lib/time'
import { primeAudio, stopCompletionTone } from '../lib/notifications'
import { useTickInterval } from './useTickInterval'
import { useAlertEffect } from './useAlertEffect'

export interface UseCountdownReturn extends ToolFace {
  state: CountdownState
  inputParts: TimeParts
  inputRefs: Record<TimePartKey, RefObject<HTMLInputElement | null>>
  setInputPart: (part: TimePartKey, value: string) => void
  padInputPart: (part: TimePartKey) => void
  overrunMs: number
  overrunActive: boolean
}

export function useCountdown(initialInputParts: TimeParts): UseCountdownReturn {
  const [state, setState] = useState<CountdownState>(() => {
    const ms = timePartsToMs(normalizeTimeParts(initialInputParts))
    return {
      durationMs: ms,
      remainingMs: ms,
      overrunMs: 0,
      endsAt: null,
      status: 'idle',
      completedAt: null,
      alertedAt: null,
    }
  })

  const [inputParts, setInputParts] = useState<TimeParts>(initialInputParts)

  const inputPartsRef = useRef(inputParts)
  inputPartsRef.current = inputParts

  const hoursRef = useRef<HTMLInputElement>(null)
  const minutesRef = useRef<HTMLInputElement>(null)
  const secondsRef = useRef<HTMLInputElement>(null)
  const inputRefs: Record<TimePartKey, RefObject<HTMLInputElement | null>> = {
    hours: hoursRef,
    minutes: minutesRef,
    seconds: secondsRef,
  }

  // --- Tick: decrement remainingMs toward 0, transition to 'done' ---

  const onCountdownTick = useCallback((now: number) => {
    setState((prev) => {
      if (prev.status !== 'running' || !prev.endsAt) return prev

      const rawRemaining = Math.max(prev.endsAt - now, 0)
      const remainingMs = rawRemaining === 0 ? 0 : Math.ceil(rawRemaining / 1000) * 1000

      if (remainingMs === 0) {
        return {
          ...prev,
          remainingMs: 0,
          overrunMs: 0,
          endsAt: null,
          status: 'done',
          completedAt: now,
          alertedAt: null,
        }
      }

      if (remainingMs === prev.remainingMs) return prev
      return { ...prev, remainingMs }
    })
  }, [])

  useTickInterval(state.status === 'running', onCountdownTick, [])

  // --- Tick: increment overrunMs after completion ---

  const onOverrunTick = useCallback((now: number) => {
    setState((prev) => {
      if (prev.status !== 'done' || prev.completedAt === null) return prev

      const overrunMs = Math.max(Math.floor((now - prev.completedAt) / 1000), 0) * 1000
      if (overrunMs === prev.overrunMs) return prev
      return { ...prev, overrunMs }
    })
  }, [])

  useTickInterval(state.status === 'done', onOverrunTick, [])

  // --- Alert: trigger completion tone when done ---

  const shouldAlert =
    state.status === 'done' &&
    state.completedAt !== null &&
    state.overrunMs > 0 &&
    state.alertedAt !== state.completedAt

  const onAlerted = useCallback(() => {
    setState((prev) => ({ ...prev, alertedAt: prev.completedAt }))
  }, [])

  useAlertEffect(shouldAlert, onAlerted, [])

  // --- Derived values ---

  const parsedInputMs = timePartsToMs(normalizeTimeParts(inputParts))
  const inputInvalid = !isValidTimeParts(inputParts) || parsedInputMs === 0
  const inputDisabled = state.status === 'running' || state.status === 'paused'
  const previewMs = parsedInputMs > 0 ? parsedInputMs : state.durationMs
  const displayMs = state.status === 'idle' ? previewMs : state.remainingMs
  const readoutBlinking = state.status === 'done'
  const progress =
    state.status === 'idle' || state.durationMs <= 0
      ? 0
      : Math.round(((state.durationMs - state.remainingMs) / state.durationMs) * 100)
  const overrunActive = state.status === 'done'

  // --- Handlers ---

  const start = useCallback(() => {
    stopCompletionTone()

    const nextParts = normalizeTimeParts(inputPartsRef.current)
    setInputParts(nextParts)

    const nextDurationMs = timePartsToMs(nextParts)
    if (!isValidTimeParts(nextParts) || nextDurationMs === 0) return

    void (async () => {
      await primeAudio()
      const now = Date.now()
      setState({
        durationMs: nextDurationMs,
        remainingMs: nextDurationMs,
        overrunMs: 0,
        endsAt: now + nextDurationMs,
        status: 'running',
        completedAt: null,
        alertedAt: null,
      })
    })()
  }, [])

  const pause = useCallback(() => {
    stopCompletionTone()
    const now = Date.now()

    setState((prev) => {
      if (prev.status !== 'running' || !prev.endsAt) return prev
      return {
        ...prev,
        remainingMs: Math.ceil(Math.max(prev.endsAt - now, 0) / 1000) * 1000,
        endsAt: null,
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
          endsAt: now + prev.remainingMs,
          status: 'running',
        }
      })
    })()
  }, [])

  const stop = useCallback(() => {
    stopCompletionTone()

    const currentParts = inputPartsRef.current
    const ms = timePartsToMs(normalizeTimeParts(currentParts))
    const invalid = !isValidTimeParts(currentParts) || ms === 0

    setState((prev) => {
      const resetMs = invalid ? prev.durationMs : ms
      return {
        durationMs: resetMs,
        remainingMs: resetMs,
        overrunMs: 0,
        endsAt: null,
        status: 'idle',
        completedAt: null,
        alertedAt: null,
      }
    })
  }, [])

  const setInputPart = useCallback((part: TimePartKey, value: string) => {
    setInputParts((prev) => ({ ...prev, [part]: value }))
  }, [])

  const padInputPart = useCallback((part: TimePartKey) => {
    setInputParts((prev) => ({ ...prev, [part]: padTimePart(prev[part]) }))
  }, [])

  return {
    state,
    status: state.status,
    displayMs,
    statusCopy: countdownStatusCopy(state),
    progress,
    readoutBlinking,
    inputInvalid,
    inputDisabled,
    inputParts,
    inputRefs,
    setInputPart,
    padInputPart,
    overrunMs: state.overrunMs,
    overrunActive,
    start,
    pause,
    resume,
    stop,
  }
}

function countdownStatusCopy(state: CountdownState): string {
  switch (state.status) {
    case 'idle':
      return 'Ready'
    case 'running':
      return state.endsAt ? `Ends ${formatClockTime(state.endsAt)}` : 'Running'
    case 'paused':
      return 'Paused'
    case 'done':
      return 'Done'
  }
}
