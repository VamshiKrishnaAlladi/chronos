import { Fragment, type ReactNode } from 'react'
import { PauseIcon, PlayIcon } from './icons'

interface ReadoutTapTargetProps {
  children: ReactNode
  isTappable: boolean
  isRunning: boolean
  expired?: boolean
  className?: string
  readoutLabel: string
  readoutValue: string
  onTap: () => void
}

export function ReadoutTapTarget({
  children,
  isTappable,
  isRunning,
  expired = false,
  className = '',
  readoutLabel,
  readoutValue,
  onTap,
}: ReadoutTapTargetProps) {
  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onTap()
    }
  }

  const classes = `tile-readout-wrap${isTappable ? ' tile-readout-tappable' : ''}${expired ? ' tile-readout-expired' : ''}${className ? ` ${className}` : ''}`

  const accessibleValue = `${readoutLabel}: ${readoutValue}`

  return (
    <Fragment>
      <div
        className={classes}
        {...(isTappable ? {
          onClick: onTap,
          onKeyDown: handleKey,
          role: 'button',
          tabIndex: 0,
          'aria-label': `${isRunning ? 'Pause' : 'Resume'} ${accessibleValue}`,
        } : {})}
      >
        {children}
        {isTappable && (
          <span className="tile-readout-overlay" aria-hidden="true">
            {isRunning ? <PauseIcon /> : <PlayIcon />}
          </span>
        )}
      </div>
      <span className="sr-only" role="timer" aria-live="off" aria-label={accessibleValue}>
        {readoutValue}
      </span>
    </Fragment>
  )
}
