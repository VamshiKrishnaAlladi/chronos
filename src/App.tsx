import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import type { AppView, ToolKind, ToolFace } from './types'
import { TOOL_LABELS } from './types'
import { formatDuration } from './lib/time'
import { loadStoredPreferences, saveStoredPreferences, saveStoredPreferencesSync, DEFAULT_POMODORO_SESSIONS } from './lib/preferences'
import { setSoundMuted as configureSoundMuted, stopCompletionTone } from './lib/notifications'
import { useCountdown } from './hooks/useCountdown'
import { useTimer } from './hooks/useTimer'
import { usePomodoro } from './hooks/usePomodoro'
import {
  ConfirmDialog,
  IconButton,
  OverrunReadout,
  PauseIcon,
  PlayIcon,
  PomodoroSessionDots,
  RestartIcon,
  ResumeIcon,
  StopIcon,
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

  const countdown = useCountdown(STORED_PREFS.countdownInputParts)
  const timer = useTimer(STORED_PREFS.timerInputParts)
  const pomo = usePomodoro(
    STORED_PREFS.pomodoroInputParts,
    STORED_PREFS.pomoBreakInputParts,
    STORED_PREFS.pomoSessionsInput,
  )

  const tools: Record<ToolKind, ToolFace> = { countdown, timer, pomodoro: pomo }
  const tool = tools[activeTool]

  const isIdle = tool.status === 'idle'
  const isRunning = tool.status === 'running'
  const isPaused = tool.status === 'paused'
  const toolLabel = TOOL_LABELS[activeTool]

  // --- Preferences persistence ---

  const prefsRef = useRef({
    activeTool, appView,
    countdownInputParts: countdown.inputParts,
    timerInputParts: timer.inputParts,
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
      timerInputParts: timer.inputParts,
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
    countdown.inputParts, timer.inputParts,
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
          <>
            <section className="hero">
              <span className="hero-kicker">{toolLabel}</span>

              {activeTool === 'countdown' ? (
                <div className="hero-readout-shell">
                  <div className={`hero-readout${tool.readoutBlinking ? ' hero-readout-expired' : ''}`}>
                    {formatDuration(tool.displayMs)}
                  </div>
                  <OverrunReadout value={countdown.overrunMs} active={countdown.overrunActive} />
                </div>
              ) : activeTool === 'pomodoro' ? (
                <div className="hero-readout-shell">
                  <div className={`hero-readout${tool.readoutBlinking ? ' hero-readout-expired' : ''}`}>
                    {formatDuration(tool.displayMs)}
                  </div>
                  <PomodoroSessionDots
                    currentSession={pomo.state.currentSession}
                    sessionsPerCycle={pomo.sessionsPerCycleDisplay}
                    currentPhase={pomo.state.currentPhase}
                    status={pomo.state.status}
                  />
                </div>
              ) : (
                <div className={`hero-readout${tool.readoutBlinking ? ' hero-readout-expired' : ''}`}>
                  {formatDuration(tool.displayMs)}
                </div>
              )}

              <div className="hero-meta">{tool.statusCopy}</div>

              <div className="hero-progress">
                <span style={{ width: `${tool.progress}%` }} />
              </div>

              <div className="hero-controls">
                <IconButton
                  label={isIdle ? `Start ${activeTool}` : `Restart ${activeTool}`}
                  onClick={tool.start}
                  disabled={tool.inputInvalid}
                >
                  {isIdle ? <PlayIcon /> : <RestartIcon />}
                </IconButton>
                <IconButton
                  label={isPaused ? `Resume ${activeTool}` : `Pause ${activeTool}`}
                  onClick={isPaused ? tool.resume : tool.pause}
                  disabled={!isRunning && !isPaused}
                >
                  {isPaused ? <ResumeIcon /> : <PauseIcon />}
                </IconButton>
                <IconButton
                  label={`Stop ${activeTool}`}
                  onClick={tool.stop}
                  disabled={isIdle}
                >
                  <StopIcon />
                </IconButton>
              </div>
            </section>

            {activeTool === 'countdown' ? (
              <section className="input-strip">
                <TimePartsInput
                  refs={countdown.inputRefs}
                  label="HH:MM:SS"
                  parts={countdown.inputParts}
                  disabled={tool.inputDisabled}
                  invalid={tool.inputInvalid}
                  onPartChange={countdown.setInputPart}
                  onPartBlur={countdown.padInputPart}
                  onFocus={stopCompletionTone}
                />
              </section>
            ) : activeTool === 'timer' ? (
              <section className="input-strip">
                <TimePartsInput
                  refs={timer.inputRefs}
                  label="HH:MM:SS"
                  parts={timer.inputParts}
                  disabled={tool.inputDisabled}
                  invalid={tool.inputInvalid}
                  onPartChange={timer.setInputPart}
                  onPartBlur={timer.padInputPart}
                  onFocus={stopCompletionTone}
                />
              </section>
            ) : (
              <section className="input-strip">
                <div className="pomo-input-strip">
                  <TimePartsInput
                    refs={pomo.workRefs}
                    label="Work"
                    parts={pomo.workInputParts}
                    disabled={tool.inputDisabled}
                    invalid={pomo.workInvalid}
                    onPartChange={pomo.setWorkPart}
                    onPartBlur={pomo.padWorkPart}
                    onFocus={stopCompletionTone}
                  />
                  <TimePartsInput
                    refs={pomo.breakRefs}
                    label="Break"
                    parts={pomo.breakInputParts}
                    disabled={tool.inputDisabled}
                    invalid={pomo.breakInvalid}
                    onPartChange={pomo.setBreakPart}
                    onPartBlur={pomo.padBreakPart}
                    onFocus={stopCompletionTone}
                  />
                  <label className="inline-input">
                    <span>Sessions</span>
                    <div className="time-input-group" aria-invalid={pomo.sessionsInvalid}>
                      <input
                        ref={pomo.sessionsRef}
                        className="time-segment pomo-sessions-input"
                        type="text"
                        inputMode="numeric"
                        aria-label="Sessions"
                        value={pomo.sessionsInput}
                        disabled={tool.inputDisabled}
                        maxLength={2}
                        onFocus={(e) => { stopCompletionTone(); e.currentTarget.select() }}
                        onChange={(e) => pomo.setSessionsInput(e.target.value.replace(/\D/g, '').slice(0, 2))}
                        onBlur={() => {
                          const n = Number(pomo.sessionsInput)
                          if (pomo.sessionsInput === '' || !Number.isInteger(n) || n < 1) {
                            pomo.setSessionsInput(DEFAULT_POMODORO_SESSIONS)
                          }
                        }}
                      />
                    </div>
                  </label>
                </div>
              </section>
            )}
          </>
        ) : (
          <DashboardView
            pendingLeave={pendingViewSwitch !== null && appView === 'dashboard'}
            onLeaveConfirmed={handleDashboardLeaveConfirmed}
            onLeaveCancelled={handleDashboardLeaveCancelled}
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
