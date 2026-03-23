export type ToolKind = 'countdown' | 'timer' | 'pomodoro'

// Unified status — 'stopped' is removed; handleStop transitions to 'idle'.
export type ToolStatus = 'idle' | 'running' | 'paused' | 'done'

export type PomodoroPhase = 'work' | 'break'

export type TimePartKey = 'hours' | 'minutes' | 'seconds'

export interface TimeParts {
  hours: string
  minutes: string
  seconds: string
}

export interface CountdownState {
  durationMs: number
  remainingMs: number
  overrunMs: number
  endsAt: number | null
  status: ToolStatus
  completedAt: number | null
  alertedAt: number | null
}

export interface TimerState {
  targetMs: number
  mainElapsedMs: number
  startedAt: number | null
  status: ToolStatus
  targetReachedAt: number | null
  alertedAt: number | null
}

export interface PomodoroState {
  workDurationMs: number
  breakMs: number
  sessionsPerCycle: number
  currentPhase: PomodoroPhase
  currentSession: number
  remainingMs: number
  endsAt: number | null
  status: ToolStatus
  completedAt: number | null
  alertedAt: number | null
}

export interface StoredPreferences {
  activeTool: ToolKind
  countdownInputParts: TimeParts
  timerInputParts: TimeParts
  pomodoroInputParts: TimeParts
  pomoBreakInputParts: TimeParts
  pomoSessionsInput: string
  soundMuted: boolean
}

/**
 * Common surface every tool hook exposes so App can render the hero
 * section, controls, and status without branching on activeTool.
 */
export interface ToolFace {
  displayMs: number
  status: ToolStatus
  statusCopy: string
  progress: number
  readoutBlinking: boolean
  inputInvalid: boolean
  inputDisabled: boolean
  start: () => void
  pause: () => void
  resume: () => void
  stop: () => void
}

export const TIME_PART_ORDER: TimePartKey[] = ['hours', 'minutes', 'seconds']

export const TOOL_LABELS: Record<ToolKind, string> = {
  countdown: 'Countdown',
  timer: 'Timer',
  pomodoro: 'Pomodoro',
}
