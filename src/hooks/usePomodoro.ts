import { useRef, useState, type RefObject } from 'react'
import type {
  PomodoroPhase,
  PomodoroState,
  TimeParts,
  TimePartKey,
  ToolFace,
  ToolStatus,
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
} from '../lib/preferences'
import { primeAudio, stopCompletionTone } from '../lib/notifications'
import { useTickInterval } from './useTickInterval'
import { useAlertEffect } from './useAlertEffect'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getNextPomodoroPhase(state: PomodoroState): {
  nextPhase: PomodoroPhase
  nextSession: number
} {
  if (state.currentPhase === 'work') {
    return { nextPhase: 'break', nextSession: state.currentSession }
  }
  return { nextPhase: 'work', nextSession: state.currentSession + 1 }
}

export function pomodoroPhaseLabel(state: PomodoroState): string {
  if (state.currentPhase === 'work') {
    return `Work ${state.currentSession}/${state.sessionsPerCycle}`
  }
  return 'Break'
}

export function getCompletedPomodoroSessions(
  currentSession: number,
  currentPhase: PomodoroPhase,
  status: ToolStatus,
): number {
  if (currentPhase === 'work') {
    return status === 'done' ? currentSession : currentSession - 1
  }
  return currentSession
}

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
    return {
      workDurationMs: workMs || parseHmsInput(DEFAULT_POMODORO_INPUT),
      breakMs: breakMs || parseHmsInput(DEFAULT_POMODORO_BREAK_INPUT),
      sessionsPerCycle: sessions > 0 ? sessions : Number(DEFAULT_POMODORO_SESSIONS),
      currentPhase: 'work',
      currentSession: 1,
      remainingMs: workMs || parseHmsInput(DEFAULT_POMODORO_INPUT),
      endsAt: null,
      status: 'idle',
      completedAt: null,
      alertedAt: null,
    }
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

  // --- Tick effect ---

  useTickInterval(
    state.status === 'running' && state.endsAt !== null,
    (now) => {
      setState((prev) => {
        if (prev.status !== 'running' || !prev.endsAt) return prev

        const rawRemainingMs = Math.max(prev.endsAt - now, 0)
        const remainingMs =
          rawRemainingMs === 0 ? 0 : Math.ceil(rawRemainingMs / 1000) * 1000

        if (remainingMs === 0) {
          return {
            ...prev,
            remainingMs: 0,
            endsAt: null,
            status: 'done' as const,
            completedAt: now,
            alertedAt: null,
          }
        }

        if (remainingMs === prev.remainingMs) return prev
        return { ...prev, remainingMs }
      })
    },
    [state.endsAt],
  )

  // --- Alert effect ---

  useAlertEffect(
    state.status === 'done' &&
      state.completedAt !== null &&
      state.alertedAt !== state.completedAt,
    () => {
      setState((prev) =>
        prev.completedAt === state.completedAt
          ? { ...prev, alertedAt: state.completedAt }
          : prev,
      )
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

    setState((prev) => {
      if (
        prev.status === 'done' &&
        !(prev.currentPhase === 'work' && prev.currentSession >= prev.sessionsPerCycle)
      ) {
        const { nextPhase, nextSession } = getNextPomodoroPhase(prev)
        const phaseDurationMs =
          nextPhase === 'work' ? prev.workDurationMs : prev.breakMs

        return {
          ...prev,
          currentPhase: nextPhase,
          currentSession: nextSession,
          remainingMs: phaseDurationMs,
          endsAt: actionedAt + phaseDurationMs,
          status: 'running' as const,
          completedAt: null,
          alertedAt: null,
        }
      }

      return {
        workDurationMs: nextWorkMs,
        breakMs: nextBreakMs,
        sessionsPerCycle: nextSessions,
        currentPhase: 'work' as const,
        currentSession: 1,
        remainingMs: nextWorkMs,
        endsAt: actionedAt + nextWorkMs,
        status: 'running' as const,
        completedAt: null,
        alertedAt: null,
      }
    })
  }

  function pause() {
    stopCompletionTone()
    const actionedAt = Date.now()

    setState((prev) => {
      if (prev.status !== 'running' || !prev.endsAt) return prev

      return {
        ...prev,
        remainingMs: Math.ceil(Math.max(prev.endsAt - actionedAt, 0) / 1000) * 1000,
        endsAt: null,
        status: 'paused' as const,
      }
    })
  }

  async function resume() {
    stopCompletionTone()
    await primeAudio()
    const actionedAt = Date.now()

    setState((prev) => {
      if (prev.status !== 'paused') return prev
      return {
        ...prev,
        endsAt: actionedAt + prev.remainingMs,
        status: 'running' as const,
      }
    })
  }

  function stop() {
    stopCompletionTone()

    const workMs = workInvalid ? state.workDurationMs : workParsedMs
    const brkMs = breakInvalid ? state.breakMs : breakParsedMs
    const sessions = sessionsInvalid ? state.sessionsPerCycle : sessionsParsed

    setState({
      workDurationMs: workMs,
      breakMs: brkMs,
      sessionsPerCycle: sessions,
      currentPhase: 'work',
      currentSession: 1,
      remainingMs: workMs,
      endsAt: null,
      status: 'idle',
      completedAt: null,
      alertedAt: null,
    })
  }

  return {
    displayMs,
    status: state.status,
    statusCopy,
    progress,
    readoutBlinking,
    inputInvalid,
    inputDisabled,
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
