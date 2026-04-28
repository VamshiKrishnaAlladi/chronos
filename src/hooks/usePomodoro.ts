import { useRef, useState, type RefObject } from 'react'
import type {
  PomodoroState,
  TimeParts,
  TimePartKey,
  ToolFace,
} from '../types'
import {
  formatClockTime,
  isValidTimeParts,
  normalizeTimeParts,
  padTimePart,
  parseHmsInput,
  timePartsToMs,
} from '../lib/time'
import {
  DEFAULT_POMODORO_BREAK_INPUT,
  DEFAULT_POMODORO_INPUT,
  DEFAULT_POMODORO_SESSIONS,
} from '../lib/defaults'
import { primeAudio, stopCompletionTone } from '../lib/notifications'
import { useTickInterval } from './useTickInterval'
import { useAlertEffect } from './useAlertEffect'
import {
  createPomodoroState,
  getCompletedPomodoroSessions,
  getNextPomodoroPhase,
  pomodoroPhaseLabel,
  reducePomodoro,
} from '../timers/pomodoroReducer'

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface UsePomodoroReturn extends ToolFace {
  state: PomodoroState
  workInputParts: TimeParts
  workRefs: Record<TimePartKey, RefObject<HTMLInputElement | null>>
  setWorkPart: (part: TimePartKey, value: string) => void
  padWorkPart: (part: TimePartKey) => void
  workInvalid: boolean
  breakInputParts: TimeParts
  breakRefs: Record<TimePartKey, RefObject<HTMLInputElement | null>>
  setBreakPart: (part: TimePartKey, value: string) => void
  padBreakPart: (part: TimePartKey) => void
  breakInvalid: boolean
  sessionsInput: string
  sessionsRef: RefObject<HTMLInputElement | null>
  setSessionsInput: (value: string) => void
  sessionsInvalid: boolean
  sessionsPerCycleDisplay: number
  completedSessions: number
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePomodoro(
  initialWorkParts: TimeParts,
  initialBreakParts: TimeParts,
  initialSessionsInput: string,
): UsePomodoroReturn {
  const [workInputParts, setWorkInputParts] = useState<TimeParts>(initialWorkParts)
  const [breakInputParts, setBreakInputParts] = useState<TimeParts>(initialBreakParts)
  const [sessionsInput, setSessionsInput] = useState<string>(initialSessionsInput)

  const workRefs: Record<TimePartKey, RefObject<HTMLInputElement | null>> = {
    hours: useRef<HTMLInputElement>(null),
    minutes: useRef<HTMLInputElement>(null),
    seconds: useRef<HTMLInputElement>(null),
  }
  const breakRefs: Record<TimePartKey, RefObject<HTMLInputElement | null>> = {
    hours: useRef<HTMLInputElement>(null),
    minutes: useRef<HTMLInputElement>(null),
    seconds: useRef<HTMLInputElement>(null),
  }
  const sessionsRef = useRef<HTMLInputElement>(null)

  const [state, setState] = useState<PomodoroState>(() => {
    const workMs = timePartsToMs(normalizeTimeParts(initialWorkParts))
    const breakMs = timePartsToMs(normalizeTimeParts(initialBreakParts))
    const sessions = Number(initialSessionsInput)
    return createPomodoroState({
      workDurationMs: workMs || parseHmsInput(DEFAULT_POMODORO_INPUT),
      breakMs: breakMs || parseHmsInput(DEFAULT_POMODORO_BREAK_INPUT),
      sessionsPerCycle: sessions > 0 ? sessions : Number(DEFAULT_POMODORO_SESSIONS),
    })
  })

  // --- Derived values ---

  const workParsedMs = timePartsToMs(normalizeTimeParts(workInputParts))
  const workInvalid = !isValidTimeParts(workInputParts) || workParsedMs === 0
  const breakParsedMs = timePartsToMs(normalizeTimeParts(breakInputParts))
  const breakInvalid = !isValidTimeParts(breakInputParts) || breakParsedMs === 0
  const sessionsParsed = Number(sessionsInput)
  const sessionsInvalid =
    sessionsInput === '' || !Number.isInteger(sessionsParsed) || sessionsParsed < 1
  const inputInvalid = workInvalid || breakInvalid || sessionsInvalid
  const inputDisabled = state.status === 'running' || state.status === 'paused'

  const previewMs = workParsedMs > 0 ? workParsedMs : state.workDurationMs
  const displayMs = state.status === 'idle' ? previewMs : state.remainingMs
  const readoutBlinking = state.status === 'done'

  const progress = (() => {
    if (state.status === 'idle') return 0
    const phaseDurationMs =
      state.currentPhase === 'work' ? state.workDurationMs : state.breakMs
    if (phaseDurationMs <= 0) return 0
    return Math.round(((phaseDurationMs - state.remainingMs) / phaseDurationMs) * 100)
  })()

  const statusCopy = (() => {
    const phaseLabel = pomodoroPhaseLabel(state)
    switch (state.status) {
      case 'idle':
        return 'Ready'
      case 'running':
        return state.endsAt
          ? `${phaseLabel} · Ends ${formatClockTime(state.endsAt)}`
          : phaseLabel
      case 'paused':
        return `${phaseLabel} · Paused`
      case 'done': {
        if (
          state.currentPhase === 'work' &&
          state.currentSession >= state.sessionsPerCycle
        ) {
          return 'Cycle complete'
        }
        const { nextPhase } = getNextPomodoroPhase(state)
        return `Done · Up next: ${nextPhase === 'work' ? 'Work' : 'Break'}`
      }
    }
  })()

  const sessionsPerCycleDisplay =
    state.status === 'idle'
      ? !sessionsInvalid
        ? sessionsParsed
        : state.sessionsPerCycle
      : state.sessionsPerCycle

  const completedSessions = getCompletedPomodoroSessions(
    state.currentSession,
    state.currentPhase,
    state.status,
  )

  const restartLabel = (() => {
    if (state.status !== 'done') return 'Restart'
    if (state.currentPhase === 'work' && state.currentSession >= state.sessionsPerCycle) {
      return 'New Cycle'
    }
    return state.currentPhase === 'work' ? 'Start Break' : 'Start Work'
  })()

  // --- Tick effect ---

  useTickInterval(
    state.status === 'running' && state.endsAt !== null,
    (now) => {
      setState((prev) => reducePomodoro(prev, { type: 'tick', now }))
    },
    [state.endsAt],
  )

  // --- Alert effect ---

  useAlertEffect(
    state.status === 'done' &&
      state.completedAt !== null &&
      state.alertedAt !== state.completedAt,
    () => {
      setState((prev) => reducePomodoro(prev, { type: 'markAlerted' }))
    },
    [state.completedAt, state.alertedAt],
  )

  // --- Input helpers ---

  function setWorkPart(part: TimePartKey, value: string) {
    setWorkInputParts((prev) => ({ ...prev, [part]: value }))
  }

  function padWorkPart(part: TimePartKey) {
    setWorkInputParts((prev) => ({ ...prev, [part]: padTimePart(prev[part]) }))
  }

  function setBreakPart(part: TimePartKey, value: string) {
    setBreakInputParts((prev) => ({ ...prev, [part]: value }))
  }

  function padBreakPart(part: TimePartKey) {
    setBreakInputParts((prev) => ({ ...prev, [part]: padTimePart(prev[part]) }))
  }

  // --- Handlers ---

  async function start() {
    stopCompletionTone()

    const nextWorkParts = normalizeTimeParts(workInputParts)
    setWorkInputParts(nextWorkParts)
    const nextWorkMs = timePartsToMs(nextWorkParts)

    const nextBreakParts = normalizeTimeParts(breakInputParts)
    setBreakInputParts(nextBreakParts)
    const nextBreakMs = timePartsToMs(nextBreakParts)

    const nextSessions = Number(sessionsInput)

    if (
      !isValidTimeParts(nextWorkParts) ||
      nextWorkMs === 0 ||
      !isValidTimeParts(nextBreakParts) ||
      nextBreakMs === 0 ||
      !Number.isInteger(nextSessions) ||
      nextSessions < 1
    ) {
      return
    }

    await primeAudio()
    const actionedAt = Date.now()

    setState((prev) => reducePomodoro(prev, {
      type: 'start',
      config: {
        workDurationMs: nextWorkMs,
        breakMs: nextBreakMs,
        sessionsPerCycle: nextSessions,
      },
      now: actionedAt,
    }))
  }

  function pause() {
    stopCompletionTone()
    const actionedAt = Date.now()

    setState((prev) => reducePomodoro(prev, { type: 'pause', now: actionedAt }))
  }

  async function resume() {
    stopCompletionTone()
    await primeAudio()
    const actionedAt = Date.now()

    setState((prev) => reducePomodoro(prev, { type: 'resume', now: actionedAt }))
  }

  function stop() {
    stopCompletionTone()

    const workMs = workInvalid ? state.workDurationMs : workParsedMs
    const brkMs = breakInvalid ? state.breakMs : breakParsedMs
    const sessions = sessionsInvalid ? state.sessionsPerCycle : sessionsParsed

    setState((prev) => reducePomodoro(prev, {
      type: 'stop',
      config: {
        workDurationMs: workMs,
        breakMs: brkMs,
        sessionsPerCycle: sessions,
      },
    }))
  }

  return {
    displayMs,
    status: state.status,
    statusCopy,
    progress,
    readoutBlinking,
    inputInvalid,
    inputDisabled,
    restartLabel,
    start: () => void start(),
    pause,
    resume: () => void resume(),
    stop,
    state,
    workInputParts,
    workRefs,
    setWorkPart,
    padWorkPart,
    workInvalid,
    breakInputParts,
    breakRefs,
    setBreakPart,
    padBreakPart,
    breakInvalid,
    sessionsInput,
    sessionsRef,
    setSessionsInput,
    sessionsInvalid,
    sessionsPerCycleDisplay,
    completedSessions,
  }
}
