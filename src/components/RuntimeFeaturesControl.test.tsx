import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RuntimeFeaturesControl } from './RuntimeFeaturesControl'

const defaults = {
  notificationPermission: 'default' as const,
  notificationRequesting: false,
  notificationRequestFailed: false,
  onRequestNotificationPermission: vi.fn(),
  keepAwake: false,
  onKeepAwakeChange: vi.fn(),
  wakeLockStatus: 'disabled' as const,
}

describe('RuntimeFeaturesControl', () => {
  it('exposes explicit notification and wake-lock controls', async () => {
    const onRequest = vi.fn()
    const onKeepAwakeChange = vi.fn()
    render(
      <RuntimeFeaturesControl
        {...defaults}
        onRequestNotificationPermission={onRequest}
        onKeepAwakeChange={onKeepAwakeChange}
      />,
    )

    const trigger = screen.getByRole('button', { name: /alerts/i })
    expect(onRequest).not.toHaveBeenCalled()
    await userEvent.click(trigger)

    await userEvent.click(screen.getByRole('button', { name: 'Enable notifications' }))
    expect(onRequest).toHaveBeenCalledTimes(1)

    await userEvent.click(screen.getByRole('checkbox', { name: /use while a timer/i }))
    expect(onKeepAwakeChange).toHaveBeenCalledWith(true)
    expect(screen.getByText(/cannot wake a fully suspended browser/i)).toBeInTheDocument()
  })

  it('reports denied and unsupported capabilities honestly', async () => {
    render(
      <RuntimeFeaturesControl
        {...defaults}
        notificationPermission="denied"
        wakeLockStatus="unsupported"
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /alerts/i }))
    expect(screen.getByText('Blocked')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Enable notifications' })).not.toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /use while a timer/i })).toBeDisabled()
  })
})
