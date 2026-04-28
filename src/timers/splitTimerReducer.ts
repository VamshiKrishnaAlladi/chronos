import type { TimerState } from '../types'

export type SplitTimerEvent =
  | { type: 'start', now: number }
  | { type: 'tick', now: number }
  | { type: 'pause', now: number }
  | { type: 'resume', now: number }
  | { type: 'stop' }
  | { type: 'split', now: number }

export function createSplitTimerState(): TimerState {
  return {
    mainElapsedMs: 0,
    startedAt: null,
    status: 'idle',
    splits: [],
  }
}

export function reduceSplitTimer(state: TimerState, event: SplitTimerEvent): TimerState {
  switch (event.type) {
    case 'start':
      return {
        mainElapsedMs: 0,
        startedAt: event.now,
        status: 'running',
        splits: [],
      }

    case 'tick':
      if (state.status !== 'running' || state.startedAt === null) return state
      return { ...state, mainElapsedMs: Math.max(event.now - state.startedAt, 0) }

    case 'pause':
      if (state.status !== 'running' || state.startedAt === null) return state
      return {
        ...state,
        mainElapsedMs: Math.max(event.now - state.startedAt, 0),
        startedAt: null,
        status: 'paused',
      }

    case 'resume':
      if (state.status !== 'paused') return state
      return {
        ...state,
        startedAt: event.now - state.mainElapsedMs,
        status: 'running',
      }

    case 'stop':
      return createSplitTimerState()

    case 'split': {
      if (state.status !== 'running' || state.startedAt === null) return state
      const cumulativeMs = Math.max(event.now - state.startedAt, 0)
      const lastCumulative =
        state.splits.length > 0
          ? state.splits[state.splits.length - 1].cumulativeMs
          : 0

      return {
        ...state,
        splits: [
          ...state.splits,
          { cumulativeMs, splitMs: cumulativeMs - lastCumulative },
        ],
      }
    }
  }
}
