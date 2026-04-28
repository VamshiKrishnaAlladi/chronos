import type { PomodoroPhase, PomodoroState, ToolStatus } from '../types'

export interface PomodoroStartConfig {
  workDurationMs: number
  breakMs: number
  sessionsPerCycle: number
}

export type PomodoroEvent =
  | { type: 'start', config: PomodoroStartConfig, now: number }
  | { type: 'tick', now: number }
  | { type: 'pause', now: number }
  | { type: 'resume', now: number }
  | { type: 'stop', config: PomodoroStartConfig }
  | { type: 'markAlerted' }

export function createPomodoroState(config: PomodoroStartConfig): PomodoroState {
  return {
    workDurationMs: config.workDurationMs,
    breakMs: config.breakMs,
    sessionsPerCycle: config.sessionsPerCycle,
    currentPhase: 'work',
    currentSession: 1,
    remainingMs: config.workDurationMs,
    endsAt: null,
    status: 'idle',
    completedAt: null,
    alertedAt: null,
  }
}

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

export function reducePomodoro(state: PomodoroState, event: PomodoroEvent): PomodoroState {
  switch (event.type) {
    case 'start':
      return startPomodoro(state, event.config, event.now)

    case 'tick': {
      if (state.status !== 'running' || !state.endsAt) return state

      const rawRemainingMs = Math.max(state.endsAt - event.now, 0)
      const remainingMs = rawRemainingMs === 0 ? 0 : Math.ceil(rawRemainingMs / 1000) * 1000
      if (remainingMs === 0) {
        return {
          ...state,
          remainingMs: 0,
          endsAt: null,
          status: 'done',
          completedAt: event.now,
          alertedAt: null,
        }
      }

      if (remainingMs === state.remainingMs) return state
      return { ...state, remainingMs }
    }

    case 'pause':
      if (state.status !== 'running' || !state.endsAt) return state
      return {
        ...state,
        remainingMs: Math.ceil(Math.max(state.endsAt - event.now, 0) / 1000) * 1000,
        endsAt: null,
        status: 'paused',
      }

    case 'resume':
      if (state.status !== 'paused') return state
      return {
        ...state,
        endsAt: event.now + state.remainingMs,
        status: 'running',
      }

    case 'stop':
      return createPomodoroState(event.config)

    case 'markAlerted':
      return { ...state, alertedAt: state.completedAt }
  }
}

function startPomodoro(
  state: PomodoroState,
  config: PomodoroStartConfig,
  now: number,
): PomodoroState {
  if (
    state.status === 'done' &&
    !(state.currentPhase === 'work' && state.currentSession >= state.sessionsPerCycle)
  ) {
    const { nextPhase, nextSession } = getNextPomodoroPhase(state)
    const phaseDurationMs = nextPhase === 'work' ? state.workDurationMs : state.breakMs

    return {
      ...state,
      currentPhase: nextPhase,
      currentSession: nextSession,
      remainingMs: phaseDurationMs,
      endsAt: now + phaseDurationMs,
      status: 'running',
      completedAt: null,
      alertedAt: null,
    }
  }

  if (state.status === 'running' || state.status === 'paused') {
    const phaseDurationMs = state.currentPhase === 'work' ? state.workDurationMs : state.breakMs
    return {
      ...state,
      remainingMs: phaseDurationMs,
      endsAt: now + phaseDurationMs,
      status: 'running',
      completedAt: null,
      alertedAt: null,
    }
  }

  return {
    ...createPomodoroState(config),
    endsAt: now + config.workDurationMs,
    status: 'running',
  }
}
