import type { ToolStatus } from '../types'

interface TimerStatusAnnouncementProps {
  label: string
  status: ToolStatus
  statusCopy: string
}

export function TimerStatusAnnouncement({
  label,
  status,
  statusCopy,
}: TimerStatusAnnouncementProps) {
  const completed = status === 'done'

  return (
    <div
      className="sr-only"
      role={completed ? 'alert' : 'status'}
      aria-live={completed ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      {label}: {statusCopy}
    </div>
  )
}
