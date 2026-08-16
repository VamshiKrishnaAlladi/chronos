import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useNotificationPermission } from './useNotificationPermission'

const originalNotification = Object.getOwnPropertyDescriptor(window, 'Notification')

function PermissionHarness() {
  const notification = useNotificationPermission()
  return (
    <>
      <output>{notification.permission}</output>
      <button type="button" onClick={() => void notification.requestPermission()}>
        Enable
      </button>
    </>
  )
}

afterEach(() => {
  if (originalNotification) Object.defineProperty(window, 'Notification', originalNotification)
  else Reflect.deleteProperty(window, 'Notification')
  vi.restoreAllMocks()
})

describe('useNotificationPermission', () => {
  it('requests permission only after an explicit user action', async () => {
    const requestPermission = vi.fn().mockResolvedValue('granted')
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: { permission: 'default', requestPermission },
    })

    render(<PermissionHarness />)
    expect(requestPermission).not.toHaveBeenCalled()
    expect(screen.getByText('default')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Enable' }))

    await waitFor(() => expect(screen.getByText('granted')).toBeInTheDocument())
    expect(requestPermission).toHaveBeenCalledTimes(1)
  })

  it('reports unsupported without attempting a request', async () => {
    Reflect.deleteProperty(window, 'Notification')

    render(<PermissionHarness />)
    expect(screen.getByText('unsupported')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Enable' }))
    expect(screen.getByText('unsupported')).toBeInTheDocument()
  })
})
