import alarmSoundUrl from '../assets/alarm.mp3'

let completionAudio: HTMLAudioElement | null = null
let repeatAlarmActive = false
let soundMuted = false

function getCompletionAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined' || typeof window.Audio === 'undefined') {
    return null
  }

  if (completionAudio) {
    return completionAudio
  }

  completionAudio = new window.Audio(alarmSoundUrl)
  completionAudio.preload = 'auto'
  completionAudio.muted = soundMuted
  return completionAudio
}

export function setSoundMuted(muted: boolean): void {
  soundMuted = muted

  if (!completionAudio) {
    return
  }

  completionAudio.muted = muted

  if (!muted) {
    return
  }

  repeatAlarmActive = false
  completionAudio.pause()
  completionAudio.currentTime = 0
  completionAudio.loop = false
}

export async function primeAudio(): Promise<void> {
  const audio = getCompletionAudio()
  if (!audio) {
    return
  }

  audio.load()

  try {
    audio.muted = true
    audio.loop = false
    await audio.play()
    audio.pause()
  } catch {
    return
  } finally {
    audio.currentTime = 0
    audio.muted = false
  }
}

export async function startRepeatingCompletionTone(): Promise<void> {
  if (repeatAlarmActive || soundMuted) {
    return
  }

  const audio = getCompletionAudio()
  if (!audio) {
    return
  }

  repeatAlarmActive = true

  try {
    audio.pause()
    audio.loop = true
    audio.currentTime = 0
    await audio.play()
  } catch {
    repeatAlarmActive = false
  }
}

export function stopCompletionTone(): void {
  repeatAlarmActive = false

  if (!completionAudio) {
    return
  }

  completionAudio.pause()
  completionAudio.currentTime = 0
  completionAudio.loop = false
}
