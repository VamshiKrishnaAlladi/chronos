import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import type { AppView, PageTitleTimer, ToolKind, ToolFace } from './types'
import { TOOL_LABELS } from './types'
import { formatDuration, formatSplitTime, msToTimeParts } from './lib/time'
import { loadStoredPreferences, saveStoredPreferences, saveStoredPreferencesSync } from './lib/preferences'
import { setSoundMuted as configureSoundMuted, stopCompletionTone } from './lib/notifications'
import { useCountdown } from './hooks/useCountdown'
import { useTimer } from './hooks/useTimer'
import { usePomodoro } from './hooks/usePomodoro'
import {
  ConfirmDialog,
  OverrunReadout,
  PauseIcon,
  PlayIcon,
  PomodoroSessionDots,
  SplitReadout,
  TimePartsInput,
} from './components'
import { DashboardView } from './components/DashboardView'

const STORED_PREFS = loadStoredPreferences()

function App() {
  const [appView, setAppView] = useState<AppView>(STORED_PREFS.appView)
  const [activeTool, setActiveTool] = useState<ToolKind>(STORED_PREFS.activeTool)
  const [pendingToolSwitch, setPendingToolSwitch] = useState<ToolKind | null>(null)
  const [pendingViewSwitch, setPendingViewSwitch] = useState<AppView | null>(null)
  const [soundMuted, setSoundMuted] = useState(STORED_PREFS.soundMuted)

  const pendingViewSwitchRef = useRef(pendingViewSwitch)
  pendingViewSwitchRef.current = pendingViewSwitch

  const dashboardTimersRef = useRef<PageTitleTimer[]>([])
  const splitBodyRef = useRef<HTMLDivElement>(null)

  const countdown = useCountdown(STORED_PREFS.countdownInputParts)
  const timer = useTimer()
  const pomo = usePomodoro(
    STORED_PREFS.pomodoroInputParts,
    STORED_PREFS.pomoBreakInputParts,
    STORED_PREFS.pomoSessionsInput,
  )

  const tools: Record<ToolKind, ToolFace> = { countdown, timer, pomodoro: pomo }
  const tool = tools[activeTool]

  useEffect(() => {
    splitBodyRef.current?.scrollTo({ top: splitBodyRef.current.scrollHeight })
  }, [timer.state.splits.length])

  const isIdle = tool.status === 'idle'
  const isRunning = tool.status === 'running'
  const isPaused = tool.status === 'paused'
  const isTappable = isRunning || isPaused
  const toolLabel = TOOL_LABELS[activeTool]

  function handleReadoutTap() {
    if (isRunning) tool.pause()
    else if (isPaused) tool.resume()
  }

  function handleReadoutKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleReadoutTap()
    }
  }

  function incrementSessions() {
    const n = Number(pomo.sessionsInput)
    if (Number.isInteger(n) && n < 99) {
      pomo.setSessionsInput(String(n + 1))
    }
  }

  function decrementSessions() {
    const n = Number(pomo.sessionsInput)
    if (Number.isInteger(n) && n > 1) {
      pomo.setSessionsInput(String(n - 1))
    }
  }

  // --- Preferences persistence ---

  const prefsRef = useRef({
    activeTool, appView,
    countdownInputParts: countdown.inputParts,
    pomodoroInputParts: pomo.workInputParts,
    pomoBreakInputParts: pomo.breakInputParts,
    pomoSessionsInput: pomo.sessionsInput,
    soundMuted,
  })

  useEffect(() => {
    const prefs = {
      activeTool,
      appView,
      countdownInputParts: countdown.inputParts,
      pomodoroInputParts: pomo.workInputParts,
      pomoBreakInputParts: pomo.breakInputParts,
      pomoSessionsInput: pomo.sessionsInput,
      soundMuted,
    }
    prefsRef.current = prefs
    saveStoredPreferences(prefs)
  }, [
    activeTool,
    appView,
    countdown.inputParts,
    pomo.workInputParts, pomo.breakInputParts, pomo.sessionsInput,
    soundMuted,
  ])

  const flushPrefs = useCallback(() => {
    saveStoredPreferencesSync(prefsRef.current)
  }, [])

  useEffect(() => {
    window.addEventListener('beforeunload', flushPrefs)
    return () => window.removeEventListener('beforeunload', flushPrefs)
  }, [flushPrefs])

  useEffect(() => {
    configureSoundMuted(soundMuted)
  }, [soundMuted])

  useEffect(() => {
    window.addEventListener('pointerdown', stopCompletionTone)
    window.addEventListener('keydown', stopCompletionTone)
    return () => {
      window.removeEventListener('pointerdown', stopCompletionTone)
      window.removeEventListener('keydown', stopCompletionTone)
    }
  }, [])

  // --- Page title ---

  useEffect(() => {
    function updateTitle() {
      const values: PageTitleTimer[] = []

      if (appView === 'focus') {
        if (activeTool === 'countdown' && tool.status === 'done') {
          values.push({ ms: countdown.state.overrunMs, overrun: true })
        } else if (tool.status === 'running' || tool.status === 'paused') {
          let remaining = 0
          if (activeTool === 'countdown') {
            remaining = countdown.state.remainingMs
          } else if (activeTool === 'pomodoro') {
            remaining = pomo.state.remainingMs
          }
          if (remaining > 0) values.push({ ms: remaining, overrun: false })
        }
      } else {
        values.push(...dashboardTimersRef.current)
      }

      if (values.length === 0) {
        document.title = 'VKA | Chronos'
        return
      }

      values.sort((a, b) => a.ms - b.ms)
      document.title = values
        .map(({ ms, overrun }) => `${overrun ? '+' : ''}${formatDuration(ms)}`)
        .join(' | ')
    }

    updateTitle()

    if (appView === 'dashboard' || (appView === 'focus' && activeTool === 'countdown' && tool.status === 'done')) {
      const id = setInterval(updateTitle, 500)
      return () => clearInterval(id)
    }
  }, [
    appView, activeTool, tool.status,
    countdown.state.remainingMs,
    countdown.state.overrunMs,
    pomo.state.remainingMs,
  ])

  // --- View switching ---

  function requestViewSwitch(target: AppView) {
    if (target === appView) return

    if (appView === 'focus') {
      if (isRunning || isPaused) {
        setPendingViewSwitch(target)
        return
      }
      stopCompletionTone()
      setAppView(target)
      return
    }

    // dashboard → focus: delegate to DashboardView via pendingLeave prop
    setPendingViewSwitch(target)
  }

  function confirmFocusViewSwitch() {
    if (!pendingViewSwitch) return
    tool.stop()
    stopCompletionTone()
    setAppView(pendingViewSwitch)
    setPendingViewSwitch(null)
  }

  const handleDashboardLeaveConfirmed = () => {
    stopCompletionTone()
    const target = pendingViewSwitchRef.current
    if (target) setAppView(target)
    setPendingViewSwitch(null)
  }

  const handleDashboardLeaveCancelled = () => {
    setPendingViewSwitch(null)
  }

  // --- Focus-mode tool switching ---

  function switchTool(next: ToolKind) {
    if (next === activeTool) return

    if (tool.readoutBlinking) {
      tool.stop()
      setActiveTool(next)
      return
    }

    if (isRunning || isPaused) {
      setPendingToolSwitch(next)
      return
    }

    setActiveTool(next)
  }

  function confirmToolSwitch() {
    if (!pendingToolSwitch) return
    tool.stop()
    setActiveTool(pendingToolSwitch)
    setPendingToolSwitch(null)
  }

  // --- Render ---

  return (
    <main className={`app-shell${appView === 'dashboard' ? ' app-shell-dashboard' : ''}`}>
      <div className="corner-controls">
        <div className="view-toggle" role="tablist" aria-label="View mode">
          <button
            type="button"
            role="tab"
            aria-selected={appView === 'dashboard'}
            className={`view-toggle-btn${appView === 'dashboard' ? ' view-toggle-btn-active' : ''}`}
            onClick={() => requestViewSwitch('dashboard')}
          >
            Dashboard
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={appView === 'focus'}
            className={`view-toggle-btn${appView === 'focus' ? ' view-toggle-btn-active' : ''}`}
            onClick={() => requestViewSwitch('focus')}
          >
            Focus
          </button>
        </div>
        <button
          type="button"
          className={`sound-corner-toggle${!soundMuted ? ' sound-corner-toggle-active' : ''}`}
          onClick={() => setSoundMuted((v) => !v)}
          aria-pressed={soundMuted}
        >
          <span className="sound-corner-toggle-label">Sound</span>
          <span className="sound-corner-toggle-state">{soundMuted ? 'Off' : 'On'}</span>
        </button>
      </div>

      {appView === 'dashboard' && <h1 className="brand-corner">Chronos</h1>}

      <div className={appView === 'focus' ? 'app-center' : 'app-center-wide'}>
        {appView === 'focus' && (
          <header className="topbar">
            <h1>Chronos</h1>
          </header>
        )}

        {appView === 'focus' ? (
          <section className="hero">
            <span className="hero-kicker">{toolLabel}</span>

            {activeTool === 'countdown' ? (
              <div className="hero-readout-shell">
                <div
                  className={`tile-readout-wrap${isTappable ? ' tile-readout-tappable' : ''}${tool.readoutBlinking ? ' tile-readout-expired' : ''}`}
                  {...(isTappable ? {
                    onClick: handleReadoutTap,
                    onKeyDown: handleReadoutKey,
                    role: 'button',
                    tabIndex: 0,
                    'aria-label': isRunning ? 'Pause' : 'Resume',
                  } : {})}
                >
                  <div className="tile-readout-input hero-readout-input">
                    <TimePartsInput
                      refs={countdown.inputRefs}
                      label="HH:MM:SS"
                      parts={isIdle ? countdown.inputParts : msToTimeParts(countdown.displayMs)}
                      disabled={!isIdle}
                      invalid={isIdle && countdown.inputInvalid}
                      onPartChange={countdown.setInputPart}
                      onPartBlur={countdown.padInputPart}
                      onFocus={stopCompletionTone}
                    />
                  </div>
                  {isTappable && (
                    <span className="tile-readout-overlay">
                      {isRunning ? <PauseIcon /> : <PlayIcon />}
                    </span>
                  )}
                </div>
                <OverrunReadout value={countdown.overrunMs} active={countdown.overrunActive} />
              </div>
            ) : activeTool === 'pomodoro' ? (
              <div className="hero-readout-shell">
                <div
                  className={`tile-readout-wrap${isTappable ? ' tile-readout-tappable' : ''}${tool.readoutBlinking ? ' tile-readout-expired' : ''}`}
                  {...(isTappable ? {
                    onClick: handleReadoutTap,
                    onKeyDown: handleReadoutKey,
                    role: 'button',
                    tabIndex: 0,
                    'aria-label': isRunning ? 'Pause' : 'Resume',
                  } : {})}
                >
                  {isIdle ? (
                    <div className="tile-pomo-idle hero-pomo-idle">
                      <span className="tile-pomo-label">Work</span>
                      <div className="tile-readout-input hero-readout-input">
                        <TimePartsInput
                          refs={pomo.workRefs}
                          label="Work"
                          parts={pomo.workInputParts}
                          disabled={false}
                          invalid={pomo.workInvalid}
                          onPartChange={pomo.setWorkPart}
                          onPartBlur={pomo.padWorkPart}
                          onFocus={stopCompletionTone}
                        />
                      </div>
                      <span className="tile-pomo-label">Break</span>
                      <div className="tile-readout-input tile-readout-input-sm hero-readout-input">
                        <TimePartsInput
                          refs={pomo.breakRefs}
                          label="Break"
                          parts={pomo.breakInputParts}
                          disabled={false}
                          invalid={pomo.breakInvalid}
                          onPartChange={pomo.setBreakPart}
                          onPartBlur={pomo.padBreakPart}
                          onFocus={stopCompletionTone}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="tile-readout-input hero-readout-input">
                      <TimePartsInput
                        refs={pomo.workRefs}
                        label="HH:MM:SS"
                        parts={msToTimeParts(pomo.displayMs)}
                        disabled={true}
                        invalid={false}
                        onPartChange={pomo.setWorkPart}
                        onPartBlur={pomo.padWorkPart}
                        onFocus={stopCompletionTone}
                      />
                    </div>
                  )}
                  {isTappable && (
                    <span className="tile-readout-overlay">
                      {isRunning ? <PauseIcon /> : <PlayIcon />}
                    </span>
                  )}
                </div>
                <div className="pomo-session-controls">
                  {isIdle && (
                    <button
                      type="button"
                      className="pomo-session-btn"
                      onClick={decrementSessions}
                      aria-label="Decrease sessions"
                    >
                      −
                    </button>
                  )}
                  <PomodoroSessionDots
                    currentSession={pomo.state.currentSession}
                    sessionsPerCycle={pomo.sessionsPerCycleDisplay}
                    currentPhase={pomo.state.currentPhase}
                    status={pomo.state.status}
                  />
                  {isIdle && (
                    <button
                      type="button"
                      className="pomo-session-btn"
                      onClick={incrementSessions}
                      aria-label="Increase sessions"
                    >
                      +
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div
                className={`tile-readout-wrap${isTappable ? ' tile-readout-tappable' : ''}`}
                {...(isTappable ? {
                  onClick: handleReadoutTap,
                  onKeyDown: handleReadoutKey,
                  role: 'button',
                  tabIndex: 0,
                  'aria-label': isRunning ? 'Pause' : 'Resume',
                } : {})}
              >
                <div className="hero-readout-input">
                  <SplitReadout ms={timer.displayMs} />
                </div>
                {isTappable && (
                  <span className="tile-readout-overlay">
                    {isRunning ? <PauseIcon /> : <PlayIcon />}
                  </span>
                )}
              </div>
            )}

            <div className="hero-meta">{tool.statusCopy}</div>

            <div className="hero-progress">
              <span style={{ width: `${tool.progress}%` }} />
            </div>

            <div className="hero-controls">
              {isIdle ? (
                <button
                  type="button"
                  className="tile-start-button"
                  onClick={tool.start}
                  disabled={tool.inputInvalid}
                >
                  Start {toolLabel}
                </button>
              ) : (
                <>
                  {tool.split && isRunning ? (
                    <button
                      type="button"
                      className="tile-pill-button tile-pill-button-accent"
                      onClick={tool.split}
                    >
                      Split
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="tile-pill-button tile-pill-button-accent"
                      onClick={tool.start}
                      disabled={tool.inputInvalid}
                    >
                      {tool.restartLabel}
                    </button>
                  )}
                  <button
                    type="button"
                    className="tile-pill-button"
                    onClick={tool.stop}
                  >
                    Stop
                  </button>
                </>
              )}
            </div>

            {activeTool === 'timer' && (
              <div className="splits-list hero-splits-list">
                {timer.state.splits.length > 0 && (
                  <>
                    <div className="splits-header">
                      <span>#</span>
                      <span>Split</span>
                      <span>Cumulative</span>
                    </div>
                    <div className="splits-body" ref={splitBodyRef}>
                      {timer.state.splits.map((s, i) => (
                        <div className="splits-row" key={i}>
                          <span>{i + 1}</span>
                          <span>{formatSplitTime(s.splitMs)}</span>
                          <span>{formatSplitTime(s.cumulativeMs)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </section>
        ) : (
          <DashboardView
            pendingLeave={pendingViewSwitch !== null && appView === 'dashboard'}
            onLeaveConfirmed={handleDashboardLeaveConfirmed}
            onLeaveCancelled={handleDashboardLeaveCancelled}
            activeTimersRef={dashboardTimersRef}
          />
        )}
      </div>

      {appView === 'focus' && (
        <div className="tool-menu" role="tablist" aria-label="Timer tools">
          {(['pomodoro', 'countdown', 'timer'] as ToolKind[]).map((t) => (
            <button
              key={t}
              type="button"
              className={`tool-menu-item${t === activeTool ? ' tool-menu-item-active' : ''}`}
              onClick={() => switchTool(t)}
              role="tab"
              aria-selected={t === activeTool}
            >
              {TOOL_LABELS[t]}
            </button>
          ))}
        </div>
      )}

      {appView === 'focus' && pendingToolSwitch && (
        <ConfirmDialog
          message={`The active ${toolLabel.toLowerCase()} will be stopped.`}
          confirmLabel="Switch"
          onConfirm={confirmToolSwitch}
          onCancel={() => setPendingToolSwitch(null)}
        />
      )}

      {appView === 'focus' && pendingViewSwitch && (
        <ConfirmDialog
          message="The active timer will be stopped."
          confirmLabel="Switch"
          onConfirm={confirmFocusViewSwitch}
          onCancel={() => setPendingViewSwitch(null)}
        />
      )}
    </main>
  )
}

export default App
