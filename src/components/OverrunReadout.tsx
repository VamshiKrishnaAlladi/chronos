import { formatDuration } from '../lib/time'

interface OverrunReadoutProps {
  value: number
  active: boolean
}

export function OverrunReadout({ value, active }: OverrunReadoutProps) {
  return (
    <div
      className={`subtimer-inline${active ? ' subtimer-inline-active' : ''}`}
      aria-hidden={!active}
      role={active ? 'timer' : undefined}
      aria-live="off"
      aria-label={active ? `Countdown overrun: ${formatDuration(value)}` : undefined}
    >
      <span className="subtimer-divider" />
      <div className="subtimer-content">
        <span className="subtimer-label">Overrun</span>
        <div className="subtimer-readout">{formatDuration(value)}</div>
      </div>
    </div>
  )
}
