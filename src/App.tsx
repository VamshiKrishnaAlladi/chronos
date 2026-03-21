import dayjs from 'dayjs'
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import './App.css'
import {
  primeAudio,
  startRepeatingCompletionTone,
  stopCompletionTone,
} from './lib/notifications'

type CountdownStatus = 'idle' | 'running' | 'paused' | 'done'

interface CountdownState {
  durationMs: number
  remainingMs: number
  endsAt: number | null
  status: CountdownStatus
  completedAt: number | null
  alertedAt: number | null
}

type TimePartKey = 'hours' | 'minutes' | 'seconds'

interface TimeParts {
  hours: string
  minutes: string
  seconds: string
}

const DEFAULT_INPUT = '00:25:00'
const TIME_PART_ORDER: TimePartKey[] = ['hours', 'minutes', 'seconds']

function App() {
  const [timeParts, setTimeParts] = useState<TimeParts>(() => splitTimeParts(DEFAULT_INPUT))
  const [timer, setTimer] = useState<CountdownState>(() => {
    const durationMs = parseHmsInput(DEFAULT_INPUT)
    return {
      durationMs,
      remainingMs: durationMs,
      endsAt: null,
      status: 'idle',
      completedAt: null,
      alertedAt: null,
    }
  })
  const inputRefs = {
    hours: useRef<HTMLInputElement>(null),
    minutes: useRef<HTMLInputElement>(null),
    seconds: useRef<HTMLInputElement>(null),
  }

  const normalizedTimeParts = normalizeTimeParts(timeParts)
  const parsedInputMs = timePartsToMs(normalizedTimeParts)
  const inputInvalid = !isValidTimeParts(timeParts) || parsedInputMs === 0
  const previewMs = parsedInputMs > 0 ? parsedInputMs : timer.durationMs
  const displayMs = timer.status === 'idle' ? previewMs : timer.remainingMs

  useEffect(() => {
    if (timer.status !== 'running' || !timer.endsAt) {
      return
    }

    const timerId = window.setInterval(() => {
      const tickAt = Date.now()

      setTimer((previousTimer) => {
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
  }, [timer.status, timer.endsAt])

  useEffect(() => {
    if (timer.status !== 'done' || !timer.completedAt || timer.alertedAt === timer.completedAt) {
      return
    }

    let cancelled = false

    void (async () => {
      await startRepeatingCompletionTone()
      if (cancelled) {
        return
      }

      setTimer((previousTimer) =>
        previousTimer.completedAt === timer.completedAt
          ? { ...previousTimer, alertedAt: timer.completedAt }
          : previousTimer,
      )
    })()

    return () => {
      cancelled = true
    }
  }, [timer.status, timer.completedAt, timer.alertedAt])

  useEffect(() => {
    const stopAlarm = () => {
      stopCompletionTone()
      setTimer((previousTimer) =>
        previousTimer.status === 'done'
          ? {
              ...previousTimer,
              remainingMs: previousTimer.durationMs,
              endsAt: null,
              status: 'idle',
              completedAt: null,
              alertedAt: null,
            }
          : previousTimer,
      )
    }

    window.addEventListener('pointerdown', stopAlarm)
    window.addEventListener('keydown', stopAlarm)

    return () => {
      window.removeEventListener('pointerdown', stopAlarm)
      window.removeEventListener('keydown', stopAlarm)
    }
  }, [])

  async function handleStart() {
    stopCompletionTone()

    const nextTimeParts = normalizeTimeParts(timeParts)
    setTimeParts(nextTimeParts)

    const nextDurationMs = timePartsToMs(nextTimeParts)
    if (!isValidTimeParts(nextTimeParts) || nextDurationMs === 0) {
      return
    }

    await primeAudio()
    const actionedAt = Date.now()

    setTimer((previousTimer) => {
      const durationMs =
        previousTimer.status === 'paused' ? previousTimer.durationMs : nextDurationMs
      const nextRemainingMs =
        previousTimer.status === 'paused' ? previousTimer.remainingMs : nextDurationMs

      return {
        durationMs,
        remainingMs: nextRemainingMs,
        endsAt: actionedAt + nextRemainingMs,
        status: 'running',
        completedAt: null,
        alertedAt: null,
      }
    })
  }

  function handlePause() {
    stopCompletionTone()
    const actionedAt = Date.now()

    setTimer((previousTimer) => {
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

  function handleStop() {
    stopCompletionTone()

    setTimer({
      durationMs: parsedInputMs,
      remainingMs: parsedInputMs,
      endsAt: null,
      status: 'idle',
      completedAt: null,
      alertedAt: null,
    })
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <h1>Chronos</h1>
      </header>

      <section className="hero">
        <span className="hero-kicker">Countdown</span>
        <div className="hero-readout">{formatDuration(displayMs)}</div>
        <div className="hero-meta">{statusCopy(timer)}</div>

        <div className="hero-progress">
          <span
            style={{
              width: `${
                timer.status === 'idle'
                  ? 0
                  : timer.durationMs > 0
                    ? Math.round(((timer.durationMs - timer.remainingMs) / timer.durationMs) * 100)
                    : 0
              }%`,
            }}
          />
        </div>

        <div className="hero-controls">
          <IconButton
            label={timer.status === 'paused' ? 'Resume countdown' : 'Start countdown'}
            onClick={() => void handleStart()}
            active={timer.status === 'running'}
            disabled={timer.status === 'running' || inputInvalid}
            large
          >
            <PlayIcon />
          </IconButton>
          <IconButton
            label="Pause countdown"
            onClick={handlePause}
            disabled={timer.status !== 'running'}
            large
          >
            <PauseIcon />
          </IconButton>
          <IconButton
            label="Stop countdown"
            onClick={handleStop}
            disabled={timer.status === 'idle'}
            large
          >
            <StopIcon />
          </IconButton>
        </div>
      </section>

      <section className="input-strip">
        <label className="inline-input">
          <span>HH:MM:SS</span>
          <div className="time-input-group" aria-invalid={inputInvalid}>
            {TIME_PART_ORDER.map((part, index) => (
              <span key={part} className="time-segment-wrap">
                <TimeSegmentInput
                  inputRef={inputRefs[part]}
                  label={part}
                  value={timeParts[part]}
                  disabled={timer.status === 'running' || timer.status === 'paused'}
                  onFocus={stopCompletionTone}
                  onChange={(value) => {
                    setTimeParts((previousParts) => ({
                      ...previousParts,
                      [part]: value,
                    }))

                    if (value.length === 2 && index < TIME_PART_ORDER.length - 1) {
                      const nextRef = inputRefs[TIME_PART_ORDER[index + 1]]
                      nextRef.current?.focus()
                      nextRef.current?.select()
                    }
                  }}
                  onBlur={() =>
                    setTimeParts((previousParts) => ({
                      ...previousParts,
                      [part]: padTimePart(previousParts[part]),
                    }))
                  }
                  onMovePrevious={
                    index > 0
                      ? () => {
                          const previousRef = inputRefs[TIME_PART_ORDER[index - 1]]
                          previousRef.current?.focus()
                          previousRef.current?.select()
                        }
                      : undefined
                  }
                  onMoveNext={
                    index < TIME_PART_ORDER.length - 1
                      ? () => {
                          const nextRef = inputRefs[TIME_PART_ORDER[index + 1]]
                          nextRef.current?.focus()
                          nextRef.current?.select()
                        }
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
    </main>
  )
}

export default App

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

function statusCopy(timer: CountdownState): string {
  switch (timer.status) {
    case 'idle':
      return 'Ready'
    case 'running':
      return timer.endsAt ? `Ends ${formatClockTime(timer.endsAt)}` : 'Running'
    case 'paused':
      return 'Paused'
    case 'done':
      return 'Done'
  }
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
  large?: boolean
}

function IconButton({ children, label, onClick, active, disabled, large }: IconButtonProps) {
  return (
    <button
      className={`icon-button${active ? ' icon-button-active' : ''}${large ? ' icon-button-large' : ''}`}
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
