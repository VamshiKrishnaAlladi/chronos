import type { PomodoroPhase, ToolStatus } from '../types'
import { PomodoroSessionDots } from './PomodoroSessionDots'

interface PomodoroSessionStepperProps {
  isIdle: boolean
  currentSession: number
  sessionsPerCycle: number
  currentPhase: PomodoroPhase
  status: ToolStatus
  onDecrement: () => void
  onIncrement: () => void
}

export function PomodoroSessionStepper({
  isIdle,
  currentSession,
  sessionsPerCycle,
  currentPhase,
  status,
  onDecrement,
  onIncrement,
}: PomodoroSessionStepperProps) {
  return (
    <div className="pomo-session-controls">
      {isIdle && (
        <button
          type="button"
          className="pomo-session-btn"
          onClick={onDecrement}
          aria-label="Decrease sessions"
        >
          −
        </button>
      )}
      <PomodoroSessionDots
        currentSession={currentSession}
        sessionsPerCycle={sessionsPerCycle}
        currentPhase={currentPhase}
        status={status}
      />
      {isIdle && (
        <button
          type="button"
          className="pomo-session-btn"
          onClick={onIncrement}
          aria-label="Increase sessions"
        >
          +
        </button>
      )}
    </div>
  )
}
