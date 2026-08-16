import { useCallback, useEffect, useRef, useState } from 'react'
import type { CountdownState, PomodoroState, TimerState, ToolKind } from '../types'
import { saveRuntimeSession } from '../lib/runtimeSessions'

type RuntimeState = CountdownState | TimerState | PomodoroState

export function useRuntimeSessionState<T extends RuntimeState>(
  sessionId: string,
  kind: ToolKind,
  initialize: () => T,
): [T, (update: (previous: T) => T, persist?: boolean | ((previous: T, next: T) => boolean)) => void] {
  const [state, setRenderedState] = useState<T>(initialize)
  const stateRef = useRef(state)

  const updateState = useCallback((
    update: (previous: T) => T,
    persist: boolean | ((previous: T, next: T) => boolean) = true,
  ) => {
    const previous = stateRef.current
    const next = update(previous)
    stateRef.current = next
    setRenderedState(next)
    const shouldPersist = typeof persist === 'function' ? persist(previous, next) : persist
    if (shouldPersist) saveRuntimeSession(sessionId, kind, next)
  }, [kind, sessionId])

  useEffect(() => {
    function flush() {
      saveRuntimeSession(sessionId, kind, stateRef.current)
    }

    function flushWhenHidden() {
      if (document.visibilityState === 'hidden') flush()
    }

    window.addEventListener('beforeunload', flush)
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', flushWhenHidden)
    return () => {
      window.removeEventListener('beforeunload', flush)
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', flushWhenHidden)
    }
  }, [kind, sessionId])

  return [state, updateState]
}
