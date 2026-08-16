import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { showHiddenCompletionNotification } from './completionNotifications'

const originalNotification = Object.getOwnPropertyDescriptor(window, 'Notification')
const originalServiceWorker = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker')
const originalHidden = Object.getOwnPropertyDescriptor(document, 'hidden')

function installNotification(permission: NotificationPermission) {
  const constructor = vi.fn()
  Object.assign(constructor, {
    permission,
    requestPermission: vi.fn().mockResolvedValue(permission),
  })
  Object.defineProperty(window, 'Notification', {
    configurable: true,
    value: constructor,
  })
  return constructor
}

function restoreProperty(target: object, key: string, descriptor?: PropertyDescriptor) {
  if (descriptor) Object.defineProperty(target, key, descriptor)
  else Reflect.deleteProperty(target, key)
}

describe('completion notifications', () => {
  beforeEach(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
  })

  afterEach(() => {
    restoreProperty(window, 'Notification', originalNotification)
    restoreProperty(navigator, 'serviceWorker', originalServiceWorker)
    restoreProperty(document, 'hidden', originalHidden)
    vi.restoreAllMocks()
  })

  it('uses the active service worker for a hidden-page completion', async () => {
    const NotificationMock = installNotification('granted')
    const showNotification = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        getRegistration: vi.fn().mockResolvedValue({ showNotification }),
      },
    })

    await expect(showHiddenCompletionNotification()).resolves.toBe(true)
    expect(showNotification).toHaveBeenCalledWith('Chronos', expect.objectContaining({
      body: 'Your timer is complete.',
      tag: 'chronos-timer-complete',
    }))
    expect(NotificationMock).not.toHaveBeenCalled()
  })

  it('falls back to a page notification when no service worker controls the page', async () => {
    const NotificationMock = installNotification('granted')
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { getRegistration: vi.fn().mockResolvedValue(undefined) },
    })

    await expect(showHiddenCompletionNotification()).resolves.toBe(true)
    expect(NotificationMock).toHaveBeenCalledWith('Chronos', expect.any(Object))
  })

  it('does nothing without both a hidden page and granted permission', async () => {
    const NotificationMock = installNotification('denied')

    await expect(showHiddenCompletionNotification()).resolves.toBe(false)
    expect(NotificationMock).not.toHaveBeenCalled()

    Object.assign(NotificationMock, { permission: 'granted' })
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    await expect(showHiddenCompletionNotification()).resolves.toBe(false)
    expect(NotificationMock).not.toHaveBeenCalled()
  })
})
