type CompletionNotificationTarget = {
  id: string
  label: string
  kind: 'countdown' | 'timer' | 'stopwatch' | 'pomodoro' | 'interval'
}

export type AppNotificationPermission = NotificationPermission | 'unsupported'

let audioContext: AudioContext | null = null
let repeatTimeoutId: number | null = null
let repeatAlarmActive = false

export function getNotificationPermission(): AppNotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported'
  }

  return window.Notification.permission
}

export async function requestNotificationPermission(): Promise<AppNotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported'
  }

  return window.Notification.requestPermission()
}

export async function showCompletionNotification(
  timer: CompletionNotificationTarget,
): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false
  }

  if (window.Notification.permission !== 'granted') {
    return false
  }

  const title = `Timer finished: ${timer.label}`
  const body =
    timer.kind === 'timer'
      ? 'Your timer reached its alert point while Chronos was open.'
      : timer.kind === 'stopwatch'
      ? 'Your stopwatch was stopped or completed.'
      : 'Your timer completed while Chronos was open.'

  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration()
      if (registration) {
        await registration.showNotification(title, {
          body,
          tag: `chronos-${timer.id}`,
          badge: '/favicon.svg',
          icon: '/favicon.svg',
        })
        return true
      }
    }

    new window.Notification(title, { body, tag: `chronos-${timer.id}` })
    return true
  } catch {
    return false
  }
}

export async function primeAudio(): Promise<void> {
  if (typeof window === 'undefined' || !('AudioContext' in window)) {
    return
  }

  audioContext ??= new window.AudioContext()

  if (audioContext.state === 'suspended') {
    await audioContext.resume()
  }
}

export async function playCompletionTone(): Promise<boolean> {
  if (!audioContext) {
    return false
  }

  try {
    if (audioContext.state === 'suspended') {
      await audioContext.resume()
    }

    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    const startAt = audioContext.currentTime
    oscillator.type = 'triangle'
    oscillator.frequency.setValueAtTime(880, startAt)
    oscillator.frequency.setValueAtTime(1174, startAt + 0.24)
    gainNode.gain.setValueAtTime(0.0001, startAt)
    gainNode.gain.exponentialRampToValueAtTime(0.08, startAt + 0.02)
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.18)
    gainNode.gain.setValueAtTime(0.0001, startAt + 0.22)
    gainNode.gain.exponentialRampToValueAtTime(0.08, startAt + 0.26)
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.48)
    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    oscillator.start(startAt)
    oscillator.stop(startAt + 0.52)
    return true
  } catch {
    return false
  }
}

export async function startRepeatingCompletionTone(): Promise<void> {
  if (repeatAlarmActive) {
    return
  }

  repeatAlarmActive = true

  const loop = async () => {
    const didPlay = await playCompletionTone()
    if (!didPlay || !repeatAlarmActive) {
      repeatAlarmActive = false
      repeatTimeoutId = null
      return
    }

    repeatTimeoutId = window.setTimeout(() => {
      void loop()
    }, 1100)
  }

  await loop()
}

export function stopCompletionTone(): void {
  repeatAlarmActive = false

  if (repeatTimeoutId !== null) {
    window.clearTimeout(repeatTimeoutId)
    repeatTimeoutId = null
  }
}
