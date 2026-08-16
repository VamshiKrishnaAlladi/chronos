export type CompletionNotificationPermission = NotificationPermission | 'unsupported'

const NOTIFICATION_TITLE = 'Chronos'
const NOTIFICATION_OPTIONS: NotificationOptions = {
  body: 'Your timer is complete.',
  tag: 'chronos-timer-complete',
}

export function getCompletionNotificationPermission(): CompletionNotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported'
  }

  return window.Notification.permission
}

export async function requestCompletionNotificationPermission(): Promise<CompletionNotificationPermission> {
  if (getCompletionNotificationPermission() === 'unsupported') {
    return 'unsupported'
  }

  return window.Notification.requestPermission()
}

/**
 * Shows a generic completion notification only when the page is hidden.
 * This runs when Chronos detects completion; it cannot wake a browser that the
 * operating system has fully suspended.
 */
export async function showHiddenCompletionNotification(): Promise<boolean> {
  if (
    typeof document === 'undefined' ||
    !document.hidden ||
    getCompletionNotificationPermission() !== 'granted'
  ) {
    return false
  }

  try {
    const registration = await getServiceWorkerRegistration()
    if (registration && typeof registration.showNotification === 'function') {
      await registration.showNotification(NOTIFICATION_TITLE, NOTIFICATION_OPTIONS)
      return true
    }

    new window.Notification(NOTIFICATION_TITLE, NOTIFICATION_OPTIONS)
    return true
  } catch {
    return false
  }
}

async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | undefined> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return undefined
  }

  try {
    return await navigator.serviceWorker.getRegistration()
  } catch {
    return undefined
  }
}
