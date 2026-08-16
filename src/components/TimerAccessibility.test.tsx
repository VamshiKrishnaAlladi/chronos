import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ReadoutTapTarget } from './ReadoutTapTarget'
import { TimerStatusAnnouncement } from './TimerStatusAnnouncement'

describe('timer accessibility semantics', () => {
  it('exposes a queryable, non-live timer value and an action name', () => {
    render(
      <ReadoutTapTarget
        isTappable={true}
        isRunning={true}
        readoutLabel="Countdown"
        readoutValue="2 minutes, 10 seconds"
        onTap={vi.fn()}
      >
        <span>02:10</span>
      </ReadoutTapTarget>,
    )

    expect(screen.getByRole('button')).toHaveAccessibleName(
      'Pause Countdown: 2 minutes, 10 seconds',
    )
    const timer = screen.getByRole('timer', { name: 'Countdown: 2 minutes, 10 seconds' })
    expect(timer).toHaveAttribute('aria-live', 'off')
  })

  it('uses a polite status for transitions and an assertive alert for completion', () => {
    const { rerender } = render(
      <TimerStatusAnnouncement label="Countdown" status="running" statusCopy="Running" />,
    )

    expect(screen.getByRole('status')).toHaveTextContent('Countdown: Running')
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')

    rerender(<TimerStatusAnnouncement label="Countdown" status="done" statusCopy="Done" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Countdown: Done')
    expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive')
  })
})
