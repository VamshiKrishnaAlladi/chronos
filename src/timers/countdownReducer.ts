import type { CountdownState } from '../types'

export type CountdownEvent =
  | { type: 'start', durationMs: number, now: number }
  | { type: 'tick', now: number }
  | { type: 'tickOverrun', now: number }
  | { type: 'pause', now: number }
  | { type: 'resume', now: number }
  | { type: 'stop', resetMs: number }
  | { type: 'markAlerted' }

export function createCountdownState(durationMs: number): CountdownState {
  return {
    durationMs,
    remainingMs: durationMs,
    overrunMs: 0,
    endsAt: null,
    status: 'idle',
    completedAt: null,
    alertedAt: null,
  }
}

export function reduceCountdown(state: CountdownState, event: CountdownEvent): CountdownState {
  switch (event.type) {
    case 'start':
      return {
        durationMs: event.durationMs,
        remainingMs: event.durationMs,
        overrunMs: 0,
        endsAt: event.now + event.durationMs,
        status: 'running',
        completedAt: null,
        alertedAt: null,
      }

    case 'tick': {
      if (state.status !== 'running' || !state.endsAt) return state

      const rawRemaining = Math.max(state.endsAt - event.now, 0)
      const remainingMs = rawRemaining === 0 ? 0 : Math.ceil(rawRemaining / 1000) * 1000
      if (remainingMs === 0) {
        return {
          ...state,
          remainingMs: 0,
          overrunMs: 0,
          endsAt: null,
          status: 'done',
          completedAt: event.now,
          alertedAt: null,
        }
      }

      if (remainingMs === state.remainingMs) return state
      return { ...state, remainingMs }
    }

    case 'tickOverrun': {
      if (state.status !== 'done' || state.completedAt === null) return state

      const overrunMs = Math.max(Math.floor((event.now - state.completedAt) / 1000), 0) * 1000
      if (overrunMs === state.overrunMs) return state
      return { ...state, overrunMs }
    }

    case 'pause': {
      if (state.status !== 'running' || !state.endsAt) return state
      return {
        ...state,
        remainingMs: Math.ceil(Math.max(state.endsAt - event.now, 0) / 1000) * 1000,
        endsAt: null,
        status: 'paused',
      }
    }

    case 'resume':
      if (state.status !== 'paused') return state
      return {
        ...state,
        endsAt: event.now + state.remainingMs,
        status: 'running',
      }

    case 'stop':
      return createCountdownState(event.resetMs)

    case 'markAlerted':
      return { ...state, alertedAt: state.completedAt }
  }
}
