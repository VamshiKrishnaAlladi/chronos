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
import { createCountdownState, reduceCountdown } from '../timers/countdownReducer'

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
    return createCountdownState(ms)
  })

  const [inputParts, setInputParts] = useState<TimeParts>(initialInputParts)

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
    setState((prev) => reduceCountdown(prev, { type: 'tick', now }))
  }, [])

  useTickInterval(state.status === 'running', onCountdownTick, [])

  // --- Tick: increment overrunMs after completion ---

  const onOverrunTick = useCallback((now: number) => {
    setState((prev) => reduceCountdown(prev, { type: 'tickOverrun', now }))
  }, [])

  useTickInterval(state.status === 'done', onOverrunTick, [])

  // --- Alert: trigger completion tone when done ---

  const shouldAlert =
    state.status === 'done' &&
    state.completedAt !== null &&
    state.overrunMs > 0 &&
    state.alertedAt !== state.completedAt

  const onAlerted = useCallback(() => {
    setState((prev) => reduceCountdown(prev, { type: 'markAlerted' }))
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

    const nextParts = normalizeTimeParts(inputParts)
    setInputParts(nextParts)

    const nextDurationMs = timePartsToMs(nextParts)
    if (!isValidTimeParts(nextParts) || nextDurationMs === 0) return

    void (async () => {
      await primeAudio()
      const now = Date.now()
      setState((prev) => reduceCountdown(prev, { type: 'start', durationMs: nextDurationMs, now }))
    })()
  }, [inputParts])

  const pause = useCallback(() => {
    stopCompletionTone()
    const now = Date.now()

    setState((prev) => reduceCountdown(prev, { type: 'pause', now }))
  }, [])

  const resume = useCallback(() => {
    stopCompletionTone()

    void (async () => {
      await primeAudio()
      const now = Date.now()
      setState((prev) => {
        if (prev.status !== 'paused') return prev
        return reduceCountdown(prev, { type: 'resume', now })
      })
    })()
  }, [])

  const stop = useCallback(() => {
    stopCompletionTone()

    const currentParts = inputParts
    const ms = timePartsToMs(normalizeTimeParts(currentParts))
    const invalid = !isValidTimeParts(currentParts) || ms === 0

    setState((prev) => reduceCountdown(prev, { type: 'stop', resetMs: invalid ? prev.durationMs : ms }))
  }, [inputParts])

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
    restartLabel: 'Restart',
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
