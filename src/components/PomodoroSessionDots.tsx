import { type PomodoroPhase, type ToolStatus } from '../types'

function getCompletedPomodoroSessions(
  currentSession: number,
  currentPhase: PomodoroPhase,
  status: ToolStatus,
): number {
  if (currentPhase === 'work') {
    return status === 'done' ? currentSession : currentSession - 1
  }

  return currentSession
}

interface PomodoroSessionDotsProps {
  currentSession: number
  sessionsPerCycle: number
  currentPhase: PomodoroPhase
  status: ToolStatus
}

export function PomodoroSessionDots({
  currentSession,
  sessionsPerCycle,
  currentPhase,
  status,
}: PomodoroSessionDotsProps) {
  const completedCount = getCompletedPomodoroSessions(currentSession, currentPhase, status)

  return (
    <div className="pomo-sessions" aria-label={`${completedCount} of ${sessionsPerCycle} sessions`}>
      {Array.from({ length: sessionsPerCycle }, (_, i) => {
        const sessionNum = i + 1
        const isDone = sessionNum <= completedCount
        const isCurrent =
          currentPhase === 'work' &&
          sessionNum === currentSession &&
          (status === 'running' || status === 'paused')

        return (
          <span
            key={sessionNum}
            className={`pomo-dot${isDone ? ' pomo-dot-done' : ''}${isCurrent ? ' pomo-dot-current' : ''}`}
            aria-label={
              isDone ? `Session ${sessionNum}: done` : isCurrent ? `Session ${sessionNum}: in progress` : `Session ${sessionNum}: upcoming`
            }
          />
        )
      })}
    </div>
  )
}
