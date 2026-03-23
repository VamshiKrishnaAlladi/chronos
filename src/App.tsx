import dayjs from 'dayjs'
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import './App.css'
import {
  primeAudio,
  setSoundMuted as configureSoundMuted,
  startRepeatingCompletionTone,
  stopCompletionTone,
} from './lib/notifications'

type ToolKind = 'countdown' | 'timer' | 'pomodoro'
type CountdownStatus = 'idle' | 'running' | 'paused' | 'stopped' | 'done'
type TimerStatus = 'idle' | 'running' | 'paused' | 'stopped'
type PomodoroPhase = 'work' | 'break'
type PomodoroStatus = 'idle' | 'running' | 'paused' | 'stopped' | 'done'
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

interface PomodoroState {
  workDurationMs: number
  breakMs: number
  sessionsPerCycle: number
  currentPhase: PomodoroPhase
  currentSession: number
  remainingMs: number
  endsAt: number | null
  status: PomodoroStatus
  completedAt: number | null
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
  pomodoroInputParts: TimeParts
  pomoBreakInputParts: TimeParts
  pomoSessionsInput: string
  soundMuted: boolean
}

const DEFAULT_COUNTDOWN_INPUT = '00:25:00'
const DEFAULT_TIMER_INPUT = '00:25:00'
const DEFAULT_POMODORO_INPUT = '00:25:00'
const DEFAULT_POMODORO_BREAK_INPUT = '00:05:00'
const DEFAULT_POMODORO_SESSIONS = '4'
const PREFERENCES_STORAGE_KEY = 'chronos-preferences-v1'
const TIME_PART_ORDER: TimePartKey[] = ['hours', 'minutes', 'seconds']
const TOOL_LABELS: Record<ToolKind, string> = {
  countdown: 'Countdown',
  timer: 'Timer',
  pomodoro: 'Pomodoro',
}

const STORED_PREFS = loadStoredPreferences()

function App() {
  const [activeTool, setActiveTool] = useState<ToolKind>(STORED_PREFS.activeTool)
  const [pendingToolSwitch, setPendingToolSwitch] = useState<ToolKind | null>(null)
  const [countdownInputParts, setCountdownInputParts] = useState<TimeParts>(STORED_PREFS.countdownInputParts)
  const [timerInputParts, setTimerInputParts] = useState<TimeParts>(STORED_PREFS.timerInputParts)
  const [soundMuted, setSoundMuted] = useState<boolean>(STORED_PREFS.soundMuted)
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
  const [pomodoroInputParts, setPomodoroInputParts] = useState<TimeParts>(STORED_PREFS.pomodoroInputParts)
  const [pomoBreakInputParts, setPomoBreakInputParts] = useState<TimeParts>(STORED_PREFS.pomoBreakInputParts)
  const [pomoSessionsInput, setPomoSessionsInput] = useState<string>(STORED_PREFS.pomoSessionsInput)
  const [pomodoro, setPomodoro] = useState<PomodoroState>(() => {
    const workMs = timePartsToMs(normalizeTimeParts(STORED_PREFS.pomodoroInputParts))
    const breakMs = timePartsToMs(normalizeTimeParts(STORED_PREFS.pomoBreakInputParts))
    const sessions = Number(STORED_PREFS.pomoSessionsInput)
    return {
      workDurationMs: workMs || parseHmsInput(DEFAULT_POMODORO_INPUT),
      breakMs: breakMs || parseHmsInput(DEFAULT_POMODORO_BREAK_INPUT),
      sessionsPerCycle: sessions > 0 ? sessions : Number(DEFAULT_POMODORO_SESSIONS),
      currentPhase: 'work',
      currentSession: 1,
      remainingMs: workMs || parseHmsInput(DEFAULT_POMODORO_INPUT),
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
  const pomoWorkRefs = {
    hours: useRef<HTMLInputElement>(null),
    minutes: useRef<HTMLInputElement>(null),
    seconds: useRef<HTMLInputElement>(null),
  }
  const pomoBreakRefs = {
    hours: useRef<HTMLInputElement>(null),
    minutes: useRef<HTMLInputElement>(null),
    seconds: useRef<HTMLInputElement>(null),
  }
  const pomoSessionsRef = useRef<HTMLInputElement>(null)

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

  const pomoParsedInputMs = timePartsToMs(normalizeTimeParts(pomodoroInputParts))
  const pomoWorkInvalid = !isValidTimeParts(pomodoroInputParts) || pomoParsedInputMs === 0
  const pomoBreakParsedMs = timePartsToMs(normalizeTimeParts(pomoBreakInputParts))
  const pomoBreakInvalid = !isValidTimeParts(pomoBreakInputParts) || pomoBreakParsedMs === 0
  const pomoSessionsParsed = Number(pomoSessionsInput)
  const pomoSessionsInvalid =
    pomoSessionsInput === '' || !Number.isInteger(pomoSessionsParsed) || pomoSessionsParsed < 1
  const pomoInputInvalid = pomoWorkInvalid || pomoBreakInvalid || pomoSessionsInvalid
  const pomoPreviewMs = pomoParsedInputMs > 0 ? pomoParsedInputMs : pomodoro.workDurationMs
  const pomoDisplayMs =
    pomodoro.status === 'idle' || pomodoro.status === 'stopped'
      ? pomoPreviewMs
      : pomodoro.remainingMs

  const currentTimeParts =
    activeTool === 'countdown' ? countdownInputParts : timerInputParts
  const currentInputInvalid =
    activeTool === 'countdown'
      ? countdownInputInvalid
      : activeTool === 'timer'
        ? timerInputInvalid
        : pomoInputInvalid
  const currentDisplayMs =
    activeTool === 'countdown'
      ? countdownDisplayMs
      : activeTool === 'timer'
        ? timerDisplayMs
        : pomoDisplayMs
  const currentStatusCopy =
    activeTool === 'countdown'
      ? countdownStatusCopy(countdown)
      : activeTool === 'timer'
        ? timerStatusCopy(timerTool)
        : pomodoroStatusCopy(pomodoro)
  const currentProgress =
    activeTool === 'countdown'
      ? getCountdownProgress(countdown)
      : activeTool === 'timer'
        ? getTimerProgress(timerTool)
        : getPomodoroProgress(pomodoro)
  const currentStatus =
    activeTool === 'countdown'
      ? countdown.status
      : activeTool === 'timer'
        ? timerTool.status
        : pomodoro.status
  const currentIsRunning = currentStatus === 'running'
  const currentIsPaused = currentStatus === 'paused'
  const currentIsIdle = currentStatus === 'idle'
  const currentShowsStart = currentIsIdle || currentStatus === 'stopped'
  const currentReadoutBlinking =
    activeTool === 'timer' ? timerTool.targetReachedAt !== null : currentStatus === 'done'
  const currentInputDisabled = currentIsRunning || currentIsPaused
  const currentToolLabel = TOOL_LABELS[activeTool]

  useEffect(() => {
    saveStoredPreferences({
      activeTool,
      countdownInputParts,
      timerInputParts,
      pomodoroInputParts,
      pomoBreakInputParts,
      pomoSessionsInput,
      soundMuted,
    })
  }, [activeTool, countdownInputParts, timerInputParts, pomodoroInputParts, pomoBreakInputParts, pomoSessionsInput, soundMuted])

  useEffect(() => {
    configureSoundMuted(soundMuted)
  }, [soundMuted])

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
      countdown.overrunMs === 0 ||
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
  }, [countdown.status, countdown.completedAt, countdown.overrunMs, countdown.alertedAt])

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
    if (pomodoro.status !== 'running' || !pomodoro.endsAt) {
      return
    }

    const timerId = window.setInterval(() => {
      const tickAt = Date.now()

      setPomodoro((prev) => {
        if (prev.status !== 'running' || !prev.endsAt) {
          return prev
        }

        const rawRemainingMs = Math.max(prev.endsAt - tickAt, 0)
        const remainingMs = rawRemainingMs === 0 ? 0 : Math.ceil(rawRemainingMs / 1000) * 1000

        if (remainingMs === 0) {
          return {
            ...prev,
            remainingMs: 0,
            endsAt: null,
            status: 'done',
            completedAt: tickAt,
            alertedAt: null,
          }
        }

        if (remainingMs === prev.remainingMs) {
          return prev
        }

        return { ...prev, remainingMs }
      })
    }, 250)

    return () => {
      window.clearInterval(timerId)
    }
  }, [pomodoro.status, pomodoro.endsAt])

  useEffect(() => {
    if (
      pomodoro.status !== 'done' ||
      !pomodoro.completedAt ||
      pomodoro.alertedAt === pomodoro.completedAt
    ) {
      return
    }

    let cancelled = false

    void (async () => {
      await startRepeatingCompletionTone()
      if (cancelled) {
        return
      }

      setPomodoro((prev) =>
        prev.completedAt === pomodoro.completedAt
          ? { ...prev, alertedAt: pomodoro.completedAt }
          : prev,
      )
    })()

    return () => {
      cancelled = true
    }
  }, [pomodoro.status, pomodoro.completedAt, pomodoro.alertedAt])

  useEffect(() => {
    window.addEventListener('pointerdown', stopCompletionTone)
    window.addEventListener('keydown', stopCompletionTone)

    return () => {
      window.removeEventListener('pointerdown', stopCompletionTone)
      window.removeEventListener('keydown', stopCompletionTone)
    }
  }, [])

  async function handleStart() {
    if (activeTool === 'countdown') {
      await handleCountdownStart()
      return
    }

    if (activeTool === 'timer') {
      await handleTimerStart()
      return
    }

    await handlePomodoroStart()
  }

  function handlePause() {
    if (activeTool === 'countdown') {
      handleCountdownPause()
      return
    }

    if (activeTool === 'timer') {
      handleTimerPause()
      return
    }

    handlePomodoroPause()
  }

  function handleStop() {
    if (activeTool === 'countdown') {
      handleCountdownStop()
      return
    }

    if (activeTool === 'timer') {
      handleTimerStop()
      return
    }

    handlePomodoroStop()
  }

  async function handleResume() {
    if (activeTool === 'countdown') {
      await handleCountdownResume()
      return
    }

    if (activeTool === 'timer') {
      await handleTimerResume()
      return
    }

    await handlePomodoroResume()
  }

  function confirmToolSwitch() {
    if (!pendingToolSwitch) return
    handleStop()
    setActiveTool(pendingToolSwitch)
    setPendingToolSwitch(null)
  }

  function cancelToolSwitch() {
    setPendingToolSwitch(null)
  }

  async function handlePrimaryAction() {
    await handleStart()
  }

  async function handleSecondaryAction() {
    if (currentIsRunning) {
      handlePause()
      return
    }

    if (currentIsPaused) {
      await handleResume()
    }
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

    setCountdown({
      durationMs: nextDurationMs,
      remainingMs: nextDurationMs,
      overrunMs: 0,
      endsAt: actionedAt + nextDurationMs,
      status: 'running',
      completedAt: null,
      alertedAt: null,
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

    setTimerTool({
      targetMs: nextTargetMs,
      mainElapsedMs: 0,
      startedAt: actionedAt,
      status: 'running',
      targetReachedAt: null,
      alertedAt: null,
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

  async function handleCountdownResume() {
    stopCompletionTone()
    await primeAudio()
    const actionedAt = Date.now()

    setCountdown((prev) => {
      if (prev.status !== 'paused') return prev
      return {
        ...prev,
        endsAt: actionedAt + prev.remainingMs,
        status: 'running',
      }
    })
  }

  async function handleTimerResume() {
    stopCompletionTone()
    await primeAudio()
    const actionedAt = Date.now()

    setTimerTool((prev) => {
      if (prev.status !== 'paused') return prev
      return {
        ...prev,
        startedAt: actionedAt - prev.mainElapsedMs,
        status: 'running',
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

  async function handlePomodoroStart() {
    stopCompletionTone()

    const nextWorkParts = normalizeTimeParts(pomodoroInputParts)
    setPomodoroInputParts(nextWorkParts)
    const nextWorkMs = timePartsToMs(nextWorkParts)

    const nextBreakParts = normalizeTimeParts(pomoBreakInputParts)
    setPomoBreakInputParts(nextBreakParts)
    const nextBreakMs = timePartsToMs(nextBreakParts)

    const nextSessions = Number(pomoSessionsInput)

    if (
      !isValidTimeParts(nextWorkParts) || nextWorkMs === 0 ||
      !isValidTimeParts(nextBreakParts) || nextBreakMs === 0 ||
      !Number.isInteger(nextSessions) || nextSessions < 1
    ) {
      return
    }

    await primeAudio()
    const actionedAt = Date.now()

    setPomodoro((prev) => {
      if (
        prev.status === 'done' &&
        !(prev.currentPhase === 'work' && prev.currentSession >= prev.sessionsPerCycle)
      ) {
        const { nextPhase, nextSession } = getNextPomodoroPhase(prev)
        const phaseDurationMs = nextPhase === 'work' ? prev.workDurationMs : prev.breakMs

        return {
          ...prev,
          currentPhase: nextPhase,
          currentSession: nextSession,
          remainingMs: phaseDurationMs,
          endsAt: actionedAt + phaseDurationMs,
          status: 'running',
          completedAt: null,
          alertedAt: null,
        }
      }

      return {
        workDurationMs: nextWorkMs,
        breakMs: nextBreakMs,
        sessionsPerCycle: nextSessions,
        currentPhase: 'work',
        currentSession: 1,
        remainingMs: nextWorkMs,
        endsAt: actionedAt + nextWorkMs,
        status: 'running',
        completedAt: null,
        alertedAt: null,
      }
    })
  }

  function handlePomodoroPause() {
    stopCompletionTone()
    const actionedAt = Date.now()

    setPomodoro((prev) => {
      if (prev.status !== 'running' || !prev.endsAt) {
        return prev
      }

      return {
        ...prev,
        remainingMs: Math.ceil(Math.max(prev.endsAt - actionedAt, 0) / 1000) * 1000,
        endsAt: null,
        status: 'paused',
      }
    })
  }

  async function handlePomodoroResume() {
    stopCompletionTone()
    await primeAudio()
    const actionedAt = Date.now()

    setPomodoro((prev) => {
      if (prev.status !== 'paused') return prev
      return {
        ...prev,
        endsAt: actionedAt + prev.remainingMs,
        status: 'running',
      }
    })
  }

  function handlePomodoroStop() {
    stopCompletionTone()

    const workMs = pomoWorkInvalid ? pomodoro.workDurationMs : pomoParsedInputMs
    const breakMs = pomoBreakInvalid ? pomodoro.breakMs : pomoBreakParsedMs
    const sessions = pomoSessionsInvalid ? pomodoro.sessionsPerCycle : pomoSessionsParsed

    setPomodoro({
      workDurationMs: workMs,
      breakMs,
      sessionsPerCycle: sessions,
      currentPhase: 'work',
      currentSession: 1,
      remainingMs: workMs,
      endsAt: null,
      status: 'stopped',
      completedAt: null,
      alertedAt: null,
    })
  }

  function updateVisibleInputPart(part: TimePartKey, value: string) {
    const setter = activeTool === 'countdown' ? setCountdownInputParts : setTimerInputParts

    setter((previousParts) => ({
      ...previousParts,
      [part]: value,
    }))
  }

  function padVisibleInputPart(part: TimePartKey) {
    const setter = activeTool === 'countdown' ? setCountdownInputParts : setTimerInputParts

    setter((previousParts) => ({
      ...previousParts,
      [part]: padTimePart(previousParts[part]),
    }))
  }

  return (
    <main className="app-shell">
      <button
        type="button"
        className={`sound-corner-toggle${!soundMuted ? ' sound-corner-toggle-active' : ''}`}
        onClick={() => {
          setSoundMuted((previousValue) => !previousValue)
        }}
        aria-pressed={soundMuted}
      >
        <span className="sound-corner-toggle-label">Sound</span>
        <span className="sound-corner-toggle-state">{soundMuted ? 'Off' : 'On'}</span>
      </button>

      <div className="app-center">
        <header className="topbar">
          <h1>Chronos</h1>
        </header>

        <section className="hero">
          <span className="hero-kicker">{currentToolLabel}</span>
          {activeTool === 'countdown' ? (
            <div className="hero-readout-shell">
              <div className={`hero-readout${currentReadoutBlinking ? ' hero-readout-expired' : ''}`}>
                {formatDuration(currentDisplayMs)}
              </div>
              <OverrunReadout
                value={countdown.overrunMs}
                active={countdown.status === 'done'}
              />
            </div>
          ) : activeTool === 'pomodoro' ? (
            <div className="hero-readout-shell">
              <div className={`hero-readout${currentReadoutBlinking ? ' hero-readout-expired' : ''}`}>
                {formatDuration(currentDisplayMs)}
              </div>
              <PomodoroSessionDots
                currentSession={pomodoro.currentSession}
                sessionsPerCycle={
                  pomodoro.status === 'idle' || pomodoro.status === 'stopped'
                    ? (pomoSessionsParsed > 0 ? pomoSessionsParsed : pomodoro.sessionsPerCycle)
                    : pomodoro.sessionsPerCycle
                }
                currentPhase={pomodoro.currentPhase}
                status={pomodoro.status}
              />
            </div>
          ) : (
            <div className={`hero-readout${currentReadoutBlinking ? ' hero-readout-expired' : ''}`}>
              {formatDuration(currentDisplayMs)}
            </div>
          )}
          <div className="hero-meta">{currentStatusCopy}</div>

          <div className="hero-progress">
            <span style={{ width: `${currentProgress}%` }} />
          </div>

          <div className="hero-controls">
            <IconButton
              label={currentShowsStart ? `Start ${activeTool}` : `Restart ${activeTool}`}
              onClick={() => void handlePrimaryAction()}
              disabled={currentInputInvalid}
            >
              {currentShowsStart ? <PlayIcon /> : <RestartIcon />}
            </IconButton>
            <IconButton
              label={currentIsPaused ? `Resume ${activeTool}` : `Pause ${activeTool}`}
              onClick={() => void handleSecondaryAction()}
              disabled={!currentIsRunning && !currentIsPaused}
            >
              {currentIsPaused ? <ResumeIcon /> : <PauseIcon />}
            </IconButton>
            <IconButton
              label={`Stop ${activeTool}`}
              onClick={handleStop}
              disabled={currentIsIdle || currentStatus === 'stopped'}
            >
              <StopIcon />
            </IconButton>
          </div>
        </section>

        {activeTool !== 'pomodoro' ? (
          <section className="input-strip">
            <TimePartsInput
              refs={inputRefs}
              label="HH:MM:SS"
              parts={currentTimeParts}
              disabled={currentInputDisabled}
              invalid={currentInputInvalid}
              onPartChange={(part, value) => updateVisibleInputPart(part, value)}
              onPartBlur={(part) => padVisibleInputPart(part)}
              onFocus={stopCompletionTone}
            />
          </section>
        ) : (
          <section className="input-strip">
            <div className="pomo-input-strip">
              <TimePartsInput
                refs={pomoWorkRefs}
                label="Work"
                parts={pomodoroInputParts}
                disabled={currentInputDisabled}
                invalid={pomoWorkInvalid}
                onPartChange={(part, value) =>
                  setPomodoroInputParts((prev) => ({ ...prev, [part]: value }))
                }
                onPartBlur={(part) =>
                  setPomodoroInputParts((prev) => ({ ...prev, [part]: padTimePart(prev[part]) }))
                }
                onFocus={stopCompletionTone}
              />
              <TimePartsInput
                refs={pomoBreakRefs}
                label="Break"
                parts={pomoBreakInputParts}
                disabled={currentInputDisabled}
                invalid={pomoBreakInvalid}
                onPartChange={(part, value) =>
                  setPomoBreakInputParts((prev) => ({ ...prev, [part]: value }))
                }
                onPartBlur={(part) =>
                  setPomoBreakInputParts((prev) => ({ ...prev, [part]: padTimePart(prev[part]) }))
                }
                onFocus={stopCompletionTone}
              />
              <label className="inline-input">
                <span>Sessions</span>
                <div className="time-input-group" aria-invalid={pomoSessionsInvalid}>
                  <input
                    ref={pomoSessionsRef}
                    className="time-segment pomo-sessions-input"
                    type="text"
                    inputMode="numeric"
                    aria-label="Sessions"
                    value={pomoSessionsInput}
                    disabled={currentInputDisabled}
                    maxLength={2}
                    onFocus={(event) => {
                      stopCompletionTone()
                      event.currentTarget.select()
                    }}
                    onChange={(event) => {
                      setPomoSessionsInput(event.target.value.replace(/\D/g, '').slice(0, 2))
                    }}
                    onBlur={() => {
                      const n = Number(pomoSessionsInput)
                      if (pomoSessionsInput === '' || !Number.isInteger(n) || n < 1) {
                        setPomoSessionsInput(DEFAULT_POMODORO_SESSIONS)
                      }
                    }}
                  />
                </div>
              </label>
            </div>
          </section>
        )}
      </div>

      <div className="tool-menu" role="tablist" aria-label="Timer tools">
        {(['pomodoro', 'countdown', 'timer'] as ToolKind[]).map((tool) => (
          <button
            key={tool}
            type="button"
            className={`tool-menu-item${tool === activeTool ? ' tool-menu-item-active' : ''}`}
            onClick={() => {
              if (tool === activeTool) return
              if (currentReadoutBlinking) {
                handleStop()
                setActiveTool(tool)
                return
              }
              if (currentIsRunning || currentIsPaused) {
                setPendingToolSwitch(tool)
                return
              }
              setActiveTool(tool)
            }}
            role="tab"
            aria-selected={tool === activeTool}
          >
            {TOOL_LABELS[tool]}
          </button>
        ))}
      </div>

      {pendingToolSwitch && (
        <ConfirmDialog
          message={`The active ${currentToolLabel.toLowerCase()} will be stopped.`}
          confirmLabel="Switch"
          onConfirm={confirmToolSwitch}
          onCancel={cancelToolSwitch}
        />
      )}
    </main>
  )
}

export default App

function loadStoredPreferences(): StoredPreferences {
  const defaults: StoredPreferences = {
    activeTool: 'countdown',
    countdownInputParts: splitTimeParts(DEFAULT_COUNTDOWN_INPUT),
    timerInputParts: splitTimeParts(DEFAULT_TIMER_INPUT),
    pomodoroInputParts: splitTimeParts(DEFAULT_POMODORO_INPUT),
    pomoBreakInputParts: splitTimeParts(DEFAULT_POMODORO_BREAK_INPUT),
    pomoSessionsInput: DEFAULT_POMODORO_SESSIONS,
    soundMuted: false,
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

    const activeTool: ToolKind =
      parsed.activeTool === 'timer'
        ? 'timer'
        : parsed.activeTool === 'pomodoro'
          ? 'pomodoro'
          : 'countdown'

    const pomoSessionsInput =
      typeof parsed.pomoSessionsInput === 'string' && /^\d{1,2}$/.test(parsed.pomoSessionsInput)
        ? parsed.pomoSessionsInput
        : DEFAULT_POMODORO_SESSIONS

    return {
      activeTool,
      countdownInputParts: parseStoredTimeParts(parsed.countdownInputParts, DEFAULT_COUNTDOWN_INPUT),
      timerInputParts: parseStoredTimeParts(parsed.timerInputParts, DEFAULT_TIMER_INPUT),
      pomodoroInputParts: parseStoredTimeParts(parsed.pomodoroInputParts, DEFAULT_POMODORO_INPUT),
      pomoBreakInputParts: parseStoredTimeParts(parsed.pomoBreakInputParts, DEFAULT_POMODORO_BREAK_INPUT),
      pomoSessionsInput,
      soundMuted: parsed.soundMuted === true,
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

  return { ...value }
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

function pomodoroStatusCopy(state: PomodoroState): string {
  const phaseLabel = pomodoroPhaseLabel(state)

  switch (state.status) {
    case 'idle':
      return 'Ready'
    case 'running':
      return state.endsAt ? `${phaseLabel} · Ends ${formatClockTime(state.endsAt)}` : phaseLabel
    case 'paused':
      return `${phaseLabel} · Paused`
    case 'stopped':
      return 'Stopped'
    case 'done': {
      if (state.currentPhase === 'work' && state.currentSession >= state.sessionsPerCycle) {
        return 'Cycle complete'
      }
      const { nextPhase } = getNextPomodoroPhase(state)
      return `Done · Up next: ${nextPhase === 'work' ? 'Work' : 'Break'}`
    }
  }
}

function pomodoroPhaseLabel(state: PomodoroState): string {
  if (state.currentPhase === 'work') {
    return `Work ${state.currentSession}/${state.sessionsPerCycle}`
  }

  return 'Break'
}

function getPomodoroProgress(state: PomodoroState): number {
  if (state.status === 'idle' || state.status === 'stopped') {
    return 0
  }

  const phaseDurationMs =
    state.currentPhase === 'work' ? state.workDurationMs : state.breakMs

  if (phaseDurationMs <= 0) {
    return 0
  }

  return Math.round(((phaseDurationMs - state.remainingMs) / phaseDurationMs) * 100)
}

function getNextPomodoroPhase(state: PomodoroState): {
  nextPhase: PomodoroPhase
  nextSession: number
} {
  if (state.currentPhase === 'work') {
    return { nextPhase: 'break', nextSession: state.currentSession }
  }

  return { nextPhase: 'work', nextSession: state.currentSession + 1 }
}

function getCompletedPomodoroSessions(
  currentSession: number,
  currentPhase: PomodoroPhase,
  status: PomodoroStatus,
): number {
  if (currentPhase === 'work') {
    return status === 'done' ? currentSession : currentSession - 1
  }

  return currentSession
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

interface TimePartsInputProps {
  refs: Record<TimePartKey, RefObject<HTMLInputElement | null>>
  label: string
  parts: TimeParts
  disabled: boolean
  invalid: boolean
  onPartChange: (part: TimePartKey, value: string) => void
  onPartBlur: (part: TimePartKey) => void
  onFocus?: () => void
}

function TimePartsInput({
  refs,
  label,
  parts,
  disabled,
  invalid,
  onPartChange,
  onPartBlur,
  onFocus,
}: TimePartsInputProps) {
  function focusPartRef(part: TimePartKey) {
    refs[part].current?.focus()
    refs[part].current?.select()
  }

  return (
    <label className="inline-input">
      <span>{label}</span>
      <div className="time-input-group" aria-invalid={invalid}>
        {TIME_PART_ORDER.map((part, index) => (
          <span key={part} className="time-segment-wrap">
            <TimeSegmentInput
              inputRef={refs[part]}
              label={`${label} ${part}`}
              value={parts[part]}
              disabled={disabled}
              onFocus={onFocus ?? (() => {})}
              onChange={(value) => {
                onPartChange(part, value)
                if (value.length === 2 && index < TIME_PART_ORDER.length - 1) {
                  focusPartRef(TIME_PART_ORDER[index + 1])
                }
              }}
              onBlur={() => onPartBlur(part)}
              onMovePrevious={
                index > 0 ? () => focusPartRef(TIME_PART_ORDER[index - 1]) : undefined
              }
              onMoveNext={
                index < TIME_PART_ORDER.length - 1
                  ? () => focusPartRef(TIME_PART_ORDER[index + 1])
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
  )
}

interface ConfirmDialogProps {
  message: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}

function ConfirmDialog({ message, confirmLabel, onConfirm, onCancel }: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    cancelRef.current?.focus()
  }, [])

  return (
    <div className="confirm-backdrop" onClick={onCancel} role="presentation">
      <div
        className="confirm-card"
        role="alertdialog"
        aria-modal="true"
        aria-label="Confirm action"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="confirm-message">{message}</p>
        <div className="confirm-actions">
          <button ref={cancelRef} type="button" className="confirm-button" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="confirm-button confirm-button-primary" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
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

function ResumeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 6h3v12H7z" fill="currentColor" />
      <path d="M13 6.5v11l8-5.5-8-5.5Z" fill="currentColor" />
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
  active: boolean
}

function OverrunReadout({ value, active }: OverrunReadoutProps) {
  return (
    <div
      className={`subtimer-inline${active ? ' subtimer-inline-active' : ''}`}
      aria-hidden={!active}
      aria-live={active ? 'polite' : undefined}
    >
      <span className="subtimer-divider" />
      <div className="subtimer-content">
        <span className="subtimer-label">Overrun</span>
        <div className="subtimer-readout">{formatDuration(value)}</div>
      </div>
    </div>
  )
}

interface PomodoroSessionDotsProps {
  currentSession: number
  sessionsPerCycle: number
  currentPhase: PomodoroPhase
  status: PomodoroStatus
}

function PomodoroSessionDots({
  currentSession,
  sessionsPerCycle,
  currentPhase,
  status,
}: PomodoroSessionDotsProps) {
  const completedCount = getCompletedPomodoroSessions(currentSession, currentPhase, status)

  return (
    <div className="pomo-sessions" aria-label={`${completedCount} of ${sessionsPerCycle} sessions`}>
      {Array.from({ length: sessionsPerCycle }, (_, i) => {
        const sessionNum = i + 1
        const isDone = sessionNum <= completedCount
        const isCurrent =
          currentPhase === 'work' &&
          sessionNum === currentSession &&
          (status === 'running' || status === 'paused')

        return (
          <span
            key={sessionNum}
            className={`pomo-dot${isDone ? ' pomo-dot-done' : ''}${isCurrent ? ' pomo-dot-current' : ''}`}
            aria-label={
              isDone ? `Session ${sessionNum}: done` : isCurrent ? `Session ${sessionNum}: in progress` : `Session ${sessionNum}: upcoming`
            }
          />
        )
      })}
    </div>
  )
}

