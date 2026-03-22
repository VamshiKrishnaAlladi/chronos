import dayjs from 'dayjs'
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import './App.css'
import {
  primeAudio,
  startRepeatingCompletionTone,
  stopCompletionTone,
} from './lib/notifications'

type ToolKind = 'countdown' | 'timer'
type CountdownStatus = 'idle' | 'running' | 'paused' | 'stopped' | 'done'
type TimerStatus = 'idle' | 'running' | 'paused' | 'stopped'
type TimePartKey = 'hours' | 'minutes' | 'seconds'

interface CountdownState {
  durationMs: number
  remainingMs: number
  overrunMs: number
  endsAt: number | null
  status: CountdownStatus
  completedAt: number | null
  alertedAt: number | null
}

interface TimerToolState {
  targetMs: number
  mainElapsedMs: number
  startedAt: number | null
  status: TimerStatus
  targetReachedAt: number | null
  alertedAt: number | null
}

interface TimeParts {
  hours: string
  minutes: string
  seconds: string
}

interface StoredPreferences {
  activeTool: ToolKind
  countdownInputParts: TimeParts
  timerInputParts: TimeParts
}

const DEFAULT_COUNTDOWN_INPUT = '00:25:00'
const DEFAULT_TIMER_INPUT = '00:25:00'
const PREFERENCES_STORAGE_KEY = 'chronos-preferences-v1'
const TIME_PART_ORDER: TimePartKey[] = ['hours', 'minutes', 'seconds']
const TOOL_LABELS: Record<ToolKind, string> = {
  countdown: 'Countdown',
  timer: 'Timer',
}

function App() {
  const [activeTool, setActiveTool] = useState<ToolKind>(() => loadStoredPreferences().activeTool)
  const [countdownInputParts, setCountdownInputParts] = useState<TimeParts>(() =>
    loadStoredPreferences().countdownInputParts,
  )
  const [timerInputParts, setTimerInputParts] = useState<TimeParts>(() =>
    loadStoredPreferences().timerInputParts,
  )
  const [countdown, setCountdown] = useState<CountdownState>(() => {
    const durationMs = parseHmsInput(DEFAULT_COUNTDOWN_INPUT)
    return {
      durationMs,
      remainingMs: durationMs,
      overrunMs: 0,
      endsAt: null,
      status: 'idle',
      completedAt: null,
      alertedAt: null,
    }
  })
  const [timerTool, setTimerTool] = useState<TimerToolState>(() => ({
    targetMs: parseHmsInput(DEFAULT_TIMER_INPUT),
    mainElapsedMs: 0,
    startedAt: null,
    status: 'idle',
    targetReachedAt: null,
    alertedAt: null,
  }))
  const inputRefs = {
    hours: useRef<HTMLInputElement>(null),
    minutes: useRef<HTMLInputElement>(null),
    seconds: useRef<HTMLInputElement>(null),
  }

  const countdownParsedInputMs = timePartsToMs(normalizeTimeParts(countdownInputParts))
  const countdownInputInvalid =
    !isValidTimeParts(countdownInputParts) || countdownParsedInputMs === 0
  const countdownPreviewMs =
    countdownParsedInputMs > 0 ? countdownParsedInputMs : countdown.durationMs
  const countdownDisplayMs =
    countdown.status === 'idle' || countdown.status === 'stopped'
      ? countdownPreviewMs
      : countdown.remainingMs

  const timerParsedInputMs = timePartsToMs(normalizeTimeParts(timerInputParts))
  const timerInputInvalid = !isValidTimeParts(timerInputParts) || timerParsedInputMs === 0
  const timerDisplayMs =
    timerTool.status === 'idle' || timerTool.status === 'stopped' ? 0 : timerTool.mainElapsedMs
  const countdownShowOverrun = countdown.status === 'done'

  const currentTimeParts = activeTool === 'countdown' ? countdownInputParts : timerInputParts
  const currentInputInvalid = activeTool === 'countdown' ? countdownInputInvalid : timerInputInvalid
  const currentDisplayMs = activeTool === 'countdown' ? countdownDisplayMs : timerDisplayMs
  const currentStatusCopy =
    activeTool === 'countdown' ? countdownStatusCopy(countdown) : timerStatusCopy(timerTool)
  const currentProgress =
    activeTool === 'countdown' ? getCountdownProgress(countdown) : getTimerProgress(timerTool)
  const currentIsRunning =
    activeTool === 'countdown'
      ? countdown.status === 'running'
      : timerTool.status === 'running'
  const currentIsPaused =
    activeTool === 'countdown'
      ? countdown.status === 'paused'
      : timerTool.status === 'paused'
  const currentIsIdle =
    activeTool === 'countdown' ? countdown.status === 'idle' : timerTool.status === 'idle'
  const currentShowsRestart =
    activeTool === 'countdown'
      ? countdown.status === 'stopped'
      : timerTool.status === 'stopped'
  const currentInputDisabled = currentIsRunning || currentIsPaused
  const currentToolLabel = TOOL_LABELS[activeTool]

  useEffect(() => {
    saveStoredPreferences({
      activeTool,
      countdownInputParts,
      timerInputParts,
    })
  }, [activeTool, countdownInputParts, timerInputParts])

  useEffect(() => {
    if (countdown.status !== 'running' || !countdown.endsAt) {
      return
    }

    const timerId = window.setInterval(() => {
      const tickAt = Date.now()

      setCountdown((previousTimer) => {
        if (previousTimer.status !== 'running' || !previousTimer.endsAt) {
          return previousTimer
        }

        const rawRemainingMs = Math.max(previousTimer.endsAt - tickAt, 0)
        const remainingMs =
          rawRemainingMs === 0 ? 0 : Math.ceil(rawRemainingMs / 1000) * 1000

        if (remainingMs === 0) {
          return {
            ...previousTimer,
            remainingMs: 0,
            overrunMs: 0,
            endsAt: null,
            status: 'done',
            completedAt: tickAt,
            alertedAt: null,
          }
        }

        if (remainingMs === previousTimer.remainingMs) {
          return previousTimer
        }

        return {
          ...previousTimer,
          remainingMs,
        }
      })
    }, 250)

    return () => {
      window.clearInterval(timerId)
    }
  }, [countdown.status, countdown.endsAt])

  useEffect(() => {
    if (countdown.status !== 'done' || countdown.completedAt === null) {
      return
    }

    const timerId = window.setInterval(() => {
      const tickAt = Date.now()

      setCountdown((previousTimer) => {
        if (previousTimer.status !== 'done' || previousTimer.completedAt === null) {
          return previousTimer
        }

        const overrunMs =
          Math.max(Math.floor((tickAt - previousTimer.completedAt) / 1000), 0) * 1000

        if (overrunMs === previousTimer.overrunMs) {
          return previousTimer
        }

        return {
          ...previousTimer,
          overrunMs,
        }
      })
    }, 250)

    return () => {
      window.clearInterval(timerId)
    }
  }, [countdown.status, countdown.completedAt])

  useEffect(() => {
    if (timerTool.status !== 'running' || timerTool.startedAt === null) {
      return
    }

    const timerId = window.setInterval(() => {
      const tickAt = Date.now()

      setTimerTool((previousTimer) => {
        if (previousTimer.status !== 'running' || previousTimer.startedAt === null) {
          return previousTimer
        }

        const mainElapsedMs =
          Math.max(Math.floor((tickAt - previousTimer.startedAt) / 1000), 0) * 1000
        const reachedTarget =
          previousTimer.targetReachedAt === null &&
          previousTimer.targetMs > 0 &&
          mainElapsedMs >= previousTimer.targetMs

        if (!reachedTarget && mainElapsedMs === previousTimer.mainElapsedMs) {
          return previousTimer
        }

        if (reachedTarget) {
          return {
            ...previousTimer,
            mainElapsedMs,
            targetReachedAt: previousTimer.startedAt + previousTimer.targetMs,
            alertedAt: null,
          }
        }

        return {
          ...previousTimer,
          mainElapsedMs,
        }
      })
    }, 250)

    return () => {
      window.clearInterval(timerId)
    }
  }, [timerTool.status, timerTool.startedAt])

  useEffect(() => {
    if (
      countdown.status !== 'done' ||
      !countdown.completedAt ||
      countdown.alertedAt === countdown.completedAt
    ) {
      return
    }

    let cancelled = false

    void (async () => {
      await startRepeatingCompletionTone()
      if (cancelled) {
        return
      }

      setCountdown((previousTimer) =>
        previousTimer.completedAt === countdown.completedAt
          ? { ...previousTimer, alertedAt: countdown.completedAt }
          : previousTimer,
      )
    })()

    return () => {
      cancelled = true
    }
  }, [countdown.status, countdown.completedAt, countdown.alertedAt])

  useEffect(() => {
    if (!timerTool.targetReachedAt || timerTool.alertedAt === timerTool.targetReachedAt) {
      return
    }

    let cancelled = false

    void (async () => {
      await startRepeatingCompletionTone()
      if (cancelled) {
        return
      }

      setTimerTool((previousTimer) =>
        previousTimer.targetReachedAt === timerTool.targetReachedAt
          ? { ...previousTimer, alertedAt: timerTool.targetReachedAt }
          : previousTimer,
      )
    })()

    return () => {
      cancelled = true
    }
  }, [timerTool.targetReachedAt, timerTool.alertedAt])

  useEffect(() => {
    const stopAlarm = () => {
      stopCompletionTone()
    }

    window.addEventListener('pointerdown', stopAlarm)
    window.addEventListener('keydown', stopAlarm)

    return () => {
      window.removeEventListener('pointerdown', stopAlarm)
      window.removeEventListener('keydown', stopAlarm)
    }
  }, [])

  async function handleStart() {
    if (activeTool === 'countdown') {
      await handleCountdownStart()
      return
    }

    await handleTimerStart()
  }

  function handlePause() {
    if (activeTool === 'countdown') {
      handleCountdownPause()
      return
    }

    handleTimerPause()
  }

  function handleStop() {
    if (activeTool === 'countdown') {
      handleCountdownStop()
      return
    }

    handleTimerStop()
  }

  async function handlePrimaryAction() {
    if (currentIsRunning) {
      handlePause()
      return
    }

    await handleStart()
  }

  async function handleSecondaryAction() {
    if (currentShowsRestart) {
      await handleStart()
      return
    }

    handleStop()
  }

  async function handleCountdownStart() {
    stopCompletionTone()

    const nextTimeParts = normalizeTimeParts(countdownInputParts)
    setCountdownInputParts(nextTimeParts)

    const nextDurationMs = timePartsToMs(nextTimeParts)
    if (!isValidTimeParts(nextTimeParts) || nextDurationMs === 0) {
      return
    }

    await primeAudio()
    const actionedAt = Date.now()

    setCountdown((previousTimer) => {
      const durationMs =
        previousTimer.status === 'paused' ? previousTimer.durationMs : nextDurationMs
      const remainingMs =
        previousTimer.status === 'paused' ? previousTimer.remainingMs : nextDurationMs

      return {
        durationMs,
        remainingMs,
        overrunMs: 0,
        endsAt: actionedAt + remainingMs,
        status: 'running',
        completedAt: null,
        alertedAt: null,
      }
    })
  }

  async function handleTimerStart() {
    stopCompletionTone()

    const nextTimeParts = normalizeTimeParts(timerInputParts)
    setTimerInputParts(nextTimeParts)

    const nextTargetMs = timePartsToMs(nextTimeParts)
    if (!isValidTimeParts(nextTimeParts) || nextTargetMs === 0) {
      return
    }

    await primeAudio()
    const actionedAt = Date.now()

    setTimerTool((previousTimer) => {
      if (previousTimer.status === 'paused') {
        return {
          ...previousTimer,
          startedAt: actionedAt - previousTimer.mainElapsedMs,
          status: 'running',
        }
      }

      return {
        targetMs: nextTargetMs,
        mainElapsedMs: 0,
        startedAt: actionedAt,
        status: 'running',
        targetReachedAt: null,
        alertedAt: null,
      }
    })
  }

  function handleCountdownPause() {
    stopCompletionTone()
    const actionedAt = Date.now()

    setCountdown((previousTimer) => {
      if (previousTimer.status !== 'running' || !previousTimer.endsAt) {
        return previousTimer
      }

      return {
        ...previousTimer,
        remainingMs: Math.ceil(Math.max(previousTimer.endsAt - actionedAt, 0) / 1000) * 1000,
        endsAt: null,
        status: 'paused',
      }
    })
  }

  function handleTimerPause() {
    stopCompletionTone()
    const actionedAt = Date.now()

    setTimerTool((previousTimer) => {
      if (previousTimer.status !== 'running' || previousTimer.startedAt === null) {
        return previousTimer
      }

      const mainElapsedMs =
        Math.max(Math.floor((actionedAt - previousTimer.startedAt) / 1000), 0) * 1000

      return {
        ...previousTimer,
        mainElapsedMs,
        startedAt: null,
        status: 'paused',
      }
    })
  }

  function handleCountdownStop() {
    stopCompletionTone()

    setCountdown({
      durationMs: countdownParsedInputMs,
      remainingMs: countdownParsedInputMs,
      overrunMs: 0,
      endsAt: null,
      status: 'stopped',
      completedAt: null,
      alertedAt: null,
    })
  }

  function handleTimerStop() {
    stopCompletionTone()

    setTimerTool({
      targetMs: timerParsedInputMs,
      mainElapsedMs: 0,
      startedAt: null,
      status: 'stopped',
      targetReachedAt: null,
      alertedAt: null,
    })
  }

  function updateVisibleInputPart(part: TimePartKey, value: string) {
    if (activeTool === 'countdown') {
      setCountdownInputParts((previousParts) => ({
        ...previousParts,
        [part]: value,
      }))
      return
    }

    setTimerInputParts((previousParts) => ({
      ...previousParts,
      [part]: value,
    }))
  }

  function padVisibleInputPart(part: TimePartKey) {
    if (activeTool === 'countdown') {
      setCountdownInputParts((previousParts) => ({
        ...previousParts,
        [part]: padTimePart(previousParts[part]),
      }))
      return
    }

    setTimerInputParts((previousParts) => ({
      ...previousParts,
      [part]: padTimePart(previousParts[part]),
    }))
  }

  function focusInputPart(part: TimePartKey) {
    inputRefs[part].current?.focus()
    inputRefs[part].current?.select()
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <h1>Chronos</h1>
      </header>

      <section className="hero">
        <span className="hero-kicker">{currentToolLabel}</span>
        {activeTool === 'countdown' ? (
          <div className="hero-readout-shell">
            <div className="hero-readout">{formatDuration(currentDisplayMs)}</div>
            {countdownShowOverrun ? <OverrunReadout value={countdown.overrunMs} /> : null}
          </div>
        ) : (
          <div className="hero-readout">{formatDuration(currentDisplayMs)}</div>
        )}
        <div className="hero-meta">{currentStatusCopy}</div>

        <div className="hero-progress">
          <span style={{ width: `${currentProgress}%` }} />
        </div>

        <div className="hero-controls">
          <IconButton
            label={currentIsRunning ? `Pause ${activeTool}` : `Start ${activeTool}`}
            onClick={() => void handlePrimaryAction()}
            active={currentIsRunning}
            disabled={!currentIsRunning && currentInputInvalid}
          >
            {currentIsRunning ? <PauseIcon /> : <PlayIcon />}
          </IconButton>
          <IconButton
            label={currentShowsRestart ? `Restart ${activeTool}` : `Stop ${activeTool}`}
            onClick={() => void handleSecondaryAction()}
            disabled={!currentShowsRestart && currentIsIdle}
          >
            {currentShowsRestart ? <RestartIcon /> : <StopIcon />}
          </IconButton>
        </div>
      </section>

      <section className="input-strip">
        <label className="inline-input">
          <span>HH:MM:SS</span>
          <div className="time-input-group" aria-invalid={currentInputInvalid}>
            {TIME_PART_ORDER.map((part, index) => (
              <span key={part} className="time-segment-wrap">
                <TimeSegmentInput
                  inputRef={inputRefs[part]}
                  label={part}
                  value={currentTimeParts[part]}
                  disabled={currentInputDisabled}
                  onFocus={stopCompletionTone}
                  onChange={(value) => {
                    updateVisibleInputPart(part, value)

                    if (value.length === 2 && index < TIME_PART_ORDER.length - 1) {
                      focusInputPart(TIME_PART_ORDER[index + 1])
                    }
                  }}
                  onBlur={() => {
                    padVisibleInputPart(part)
                  }}
                  onMovePrevious={
                    index > 0 ? () => focusInputPart(TIME_PART_ORDER[index - 1]) : undefined
                  }
                  onMoveNext={
                    index < TIME_PART_ORDER.length - 1
                      ? () => focusInputPart(TIME_PART_ORDER[index + 1])
                      : undefined
                  }
                />
                {index < TIME_PART_ORDER.length - 1 ? (
                  <span className="time-colon" aria-hidden="true">
                    :
                  </span>
                ) : null}
              </span>
            ))}
          </div>
        </label>
      </section>

      <div className="tool-menu" role="tablist" aria-label="Timer tools">
        {(['countdown', 'timer'] as ToolKind[]).map((tool) => (
          <button
            key={tool}
            type="button"
            className={`tool-menu-item${tool === activeTool ? ' tool-menu-item-active' : ''}`}
            onClick={() => {
              setActiveTool(tool)
            }}
            role="tab"
            aria-selected={tool === activeTool}
          >
            {TOOL_LABELS[tool]}
          </button>
        ))}
      </div>
    </main>
  )
}

export default App

function loadStoredPreferences(): StoredPreferences {
  const defaults: StoredPreferences = {
    activeTool: 'countdown',
    countdownInputParts: splitTimeParts(DEFAULT_COUNTDOWN_INPUT),
    timerInputParts: splitTimeParts(DEFAULT_TIMER_INPUT),
  }

  if (typeof window === 'undefined') {
    return defaults
  }

  const storedValue = window.localStorage.getItem(PREFERENCES_STORAGE_KEY)
  if (!storedValue) {
    return defaults
  }

  try {
    const parsed = JSON.parse(storedValue) as Partial<StoredPreferences>

    return {
      activeTool: parsed.activeTool === 'timer' ? 'timer' : 'countdown',
      countdownInputParts: parseStoredTimeParts(parsed.countdownInputParts, DEFAULT_COUNTDOWN_INPUT),
      timerInputParts: parseStoredTimeParts(parsed.timerInputParts, DEFAULT_TIMER_INPUT),
    }
  } catch {
    return defaults
  }
}

function saveStoredPreferences(preferences: StoredPreferences): void {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences))
}

function parseStoredTimeParts(value: unknown, fallback: string): TimeParts {
  if (!isStoredTimeParts(value)) {
    return splitTimeParts(fallback)
  }

  return {
    hours: value.hours,
    minutes: value.minutes,
    seconds: value.seconds,
  }
}

function isStoredTimeParts(value: unknown): value is TimeParts {
  if (!value || typeof value !== 'object') {
    return false
  }

  const parts = value as Record<string, unknown>
  return ['hours', 'minutes', 'seconds'].every(
    (partKey) => typeof parts[partKey] === 'string' && /^\d{0,2}$/.test(parts[partKey] as string),
  )
}

function splitTimeParts(value: string): TimeParts {
  const [hours = '00', minutes = '00', seconds = '00'] = value.split(':')
  return { hours, minutes, seconds }
}

function padTimePart(value: string): string {
  if (!/^\d{0,2}$/.test(value)) {
    return '00'
  }

  return value.padStart(2, '0')
}

function normalizeTimeParts(parts: TimeParts): TimeParts {
  return {
    hours: padTimePart(parts.hours),
    minutes: padTimePart(parts.minutes),
    seconds: padTimePart(parts.seconds),
  }
}

function isValidTimeParts(parts: TimeParts): boolean {
  if (![parts.hours, parts.minutes, parts.seconds].every((part) => /^\d{1,2}$/.test(part))) {
    return false
  }

  const normalizedParts = normalizeTimeParts(parts)
  const minutes = Number(normalizedParts.minutes)
  const seconds = Number(normalizedParts.seconds)
  return minutes < 60 && seconds < 60
}

function parseHmsInput(value: string): number {
  const parts = splitTimeParts(value)
  if (!isValidTimeParts(parts)) {
    return 0
  }

  return timePartsToMs(normalizeTimeParts(parts))
}

function timePartsToMs(parts: TimeParts): number {
  const hours = Number(parts.hours)
  const minutes = Number(parts.minutes)
  const seconds = Number(parts.seconds)
  return hours * 3600_000 + minutes * 60_000 + seconds * 1000
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(Math.floor(ms / 1000), 0)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return [hours, minutes, seconds].map((value) => value.toString().padStart(2, '0')).join(':')
}

function formatClockTime(timestamp: number): string {
  return dayjs(timestamp).format('hh:mm:ss A')
}

function countdownStatusCopy(timer: CountdownState): string {
  switch (timer.status) {
    case 'idle':
      return 'Ready'
    case 'running':
      return timer.endsAt ? `Ends ${formatClockTime(timer.endsAt)}` : 'Running'
    case 'paused':
      return 'Paused'
    case 'stopped':
      return 'Stopped'
    case 'done':
      return 'Done'
  }
}

function timerStatusCopy(timer: TimerToolState): string {
  if (timer.targetReachedAt) {
    return `Alerted ${formatClockTime(timer.targetReachedAt)}`
  }

  switch (timer.status) {
    case 'idle':
      return 'Ready'
    case 'running':
      return timer.startedAt ? `Alerts ${formatClockTime(timer.startedAt + timer.targetMs)}` : 'Running'
    case 'paused':
      return 'Paused'
    case 'stopped':
      return 'Stopped'
  }
}

function getCountdownProgress(timer: CountdownState): number {
  if (timer.status === 'idle' || timer.status === 'stopped') {
    return 0
  }

  if (timer.durationMs <= 0) {
    return 0
  }

  return Math.round(((timer.durationMs - timer.remainingMs) / timer.durationMs) * 100)
}

function getTimerProgress(timer: TimerToolState): number {
  if (timer.status === 'idle' || timer.status === 'stopped' || timer.targetMs <= 0) {
    return 0
  }

  return Math.min(Math.round((timer.mainElapsedMs / timer.targetMs) * 100), 100)
}

interface TimeSegmentInputProps {
  inputRef: RefObject<HTMLInputElement | null>
  label: string
  value: string
  disabled: boolean
  onFocus: () => void
  onChange: (value: string) => void
  onBlur: () => void
  onMovePrevious?: () => void
  onMoveNext?: () => void
}

function TimeSegmentInput({
  inputRef,
  label,
  value,
  disabled,
  onFocus,
  onChange,
  onBlur,
  onMovePrevious,
  onMoveNext,
}: TimeSegmentInputProps) {
  return (
    <input
      ref={inputRef}
      className="time-segment"
      type="text"
      inputMode="numeric"
      aria-label={label}
      value={value}
      disabled={disabled}
      maxLength={2}
      onFocus={(event) => {
        onFocus()
        event.currentTarget.select()
      }}
      onChange={(event) => {
        onChange(event.target.value.replace(/\D/g, '').slice(0, 2))
      }}
      onBlur={onBlur}
      onKeyDown={(event) => {
        const currentTarget = event.currentTarget

        if (event.key === 'ArrowLeft' && currentTarget.selectionStart === 0) {
          onMovePrevious?.()
        }

        if (
          (event.key === 'ArrowRight' && currentTarget.selectionStart === currentTarget.value.length) ||
          event.key === ':'
        ) {
          event.preventDefault()
          onMoveNext?.()
        }

        if (event.key === 'Backspace' && currentTarget.value.length === 0) {
          onMovePrevious?.()
        }
      }}
    />
  )
}

interface IconButtonProps {
  children: ReactNode
  label: string
  onClick: () => void
  active?: boolean
  disabled?: boolean
}

function IconButton({ children, label, onClick, active, disabled }: IconButtonProps) {
  return (
    <button
      type="button"
      className={`icon-button${active ? ' icon-button-active' : ''}`}
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 6.5v11l9-5.5-9-5.5Z" fill="currentColor" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 6h3v12H7zm7 0h3v12h-3z" fill="currentColor" />
    </svg>
  )
}

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" />
    </svg>
  )
}

function RestartIcon() {
  return (
    <svg className="restart-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M16.4017 6.28616C16.4017 5.98121 16.217 5.70662 15.9346 5.59158C15.6522 5.47653 15.3283 5.54393 15.1152 5.76208L14.3647 6.53037C12.244 5.55465 9.66551 5.95905 7.92796 7.7378C5.69068 10.0281 5.69068 13.7344 7.92796 16.0247C10.1748 18.3248 13.8252 18.3248 16.072 16.0247C17.3754 14.6904 17.9168 12.8779 17.7055 11.1507C17.6552 10.7396 17.2812 10.447 16.87 10.4973C16.4589 10.5476 16.1663 10.9217 16.2166 11.3328C16.3757 12.6335 15.9667 13.9859 14.999 14.9765C13.3407 16.6742 10.6593 16.6742 9.00097 14.9765C7.33301 13.269 7.33301 10.4935 9.00097 8.78596C10.1467 7.61303 11.7795 7.25143 13.225 7.69705L12.4635 8.47659C12.2527 8.69245 12.1917 9.01364 12.3088 9.29174C12.4259 9.56984 12.6983 9.75067 13 9.75067H15.6517C16.0659 9.75067 16.4017 9.41489 16.4017 9.00067V6.28616Z"
        fill="currentColor"
      />
    </svg>
  )
}

interface OverrunReadoutProps {
  value: number
}

function OverrunReadout({ value }: OverrunReadoutProps) {
  return (
    <div className="subtimer-inline" aria-live="polite">
      <span className="subtimer-divider" />
      <div className="subtimer-content">
        <span className="subtimer-label">Overrun</span>
        <div className="subtimer-readout">{formatDuration(value)}</div>
      </div>
    </div>
  )
}

