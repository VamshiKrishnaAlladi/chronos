import type { ReactNode } from 'react'
import { PauseIcon, PlayIcon } from './icons'

interface ReadoutTapTargetProps {
  children: ReactNode
  isTappable: boolean
  isRunning: boolean
  expired?: boolean
  className?: string
  onTap: () => void
}

export function ReadoutTapTarget({
  children,
  isTappable,
  isRunning,
  expired = false,
  className = '',
  onTap,
}: ReadoutTapTargetProps) {
  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onTap()
    }
  }

  const classes = `tile-readout-wrap${isTappable ? ' tile-readout-tappable' : ''}${expired ? ' tile-readout-expired' : ''}${className ? ` ${className}` : ''}`

  return (
    <div
      className={classes}
      {...(isTappable ? {
        onClick: onTap,
        onKeyDown: handleKey,
        role: 'button',
        tabIndex: 0,
        'aria-label': isRunning ? 'Pause' : 'Resume',
      } : {})}
    >
      {children}
      {isTappable && (
        <span className="tile-readout-overlay">
          {isRunning ? <PauseIcon /> : <PlayIcon />}
        </span>
      )}
    </div>
  )
}
