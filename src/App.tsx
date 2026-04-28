import { useCallback, useEffect, useState, useRef } from 'react'
import './styles/index.css'
import type { PageTitleTimer, ToolKind } from './types'
import { TOOL_LABELS } from './types'
import { msToTimeParts } from './lib/time'
import { loadStoredPreferences } from './lib/preferences'
import { stopCompletionTone } from './lib/notifications'
import { useCountdown } from './hooks/useCountdown'
import { useTimer } from './hooks/useTimer'
import { usePomodoro } from './hooks/usePomodoro'
import { usePageTitle } from './hooks/usePageTitle'
import { useChronosApp } from './hooks/useChronosApp'
import {
  ConfirmDialog,
  OverrunReadout,
  PomodoroSessionStepper,
  ProgressRail,
  ReadoutTapTarget,
  SplitReadout,
  SplitsPanel,
  TimePartsInput,
  ToolActionRow,
} from './components'
import { DashboardView } from './components/DashboardView'
import { VolumeControl } from './components/VolumeControl'

const STORED_PREFS = loadStoredPreferences()

function App() {
  const [dashboardTitleTimers, setDashboardTitleTimers] = useState<PageTitleTimer[]>([])
  const splitBodyRef = useRef<HTMLDivElement>(null)

  const countdown = useCountdown(STORED_PREFS.countdownInputParts)
  const timer = useTimer()
  const pomo = usePomodoro(
    STORED_PREFS.pomodoroInputParts,
    STORED_PREFS.pomoBreakInputParts,
    STORED_PREFS.pomoSessionsInput,
  )

  const {
    appView,
    activeTool,
    pendingToolSwitch,
    pendingViewSwitch,
    soundVolume,
    setSoundVolume,
    tool,
    toolLabel,
    isIdle,
    isRunning,
    isPaused,
    isTappable,
    requestViewSwitch,
    confirmFocusViewSwitch,
    handleDashboardLeaveConfirmed,
    handleDashboardLeaveCancelled,
    switchTool,
    confirmToolSwitch,
    cancelToolSwitch,
    cancelFocusViewSwitch,
  } = useChronosApp({
    initialPrefs: STORED_PREFS,
    countdown,
    timer,
    pomo,
  })

  useEffect(() => {
    splitBodyRef.current?.scrollTo({ top: splitBodyRef.current.scrollHeight })
  }, [timer.state.splits.length])

  function handleReadoutTap() {
    if (isRunning) tool.pause()
    else if (isPaused) tool.resume()
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

  // --- Page title ---

  const getPageTitleValues = useCallback((): PageTitleTimer[] => {
    if (appView === 'dashboard') {
      return dashboardTitleTimers
    }

    if (activeTool === 'countdown' && tool.status === 'done') {
      return [{ ms: countdown.state.overrunMs, overrun: true }]
    }

    if (tool.status !== 'running' && tool.status !== 'paused') {
      return []
    }

    if (activeTool === 'countdown' && countdown.state.remainingMs > 0) {
      return [{ ms: countdown.state.remainingMs, overrun: false }]
    }

    if (activeTool === 'pomodoro' && pomo.state.remainingMs > 0) {
      return [{ ms: pomo.state.remainingMs, overrun: false }]
    }

    return []
  }, [
    appView,
    activeTool,
    tool.status,
    countdown.state.remainingMs,
    countdown.state.overrunMs,
    dashboardTitleTimers,
    pomo.state.remainingMs,
  ])

  usePageTitle({
    getValues: getPageTitleValues,
    refresh: appView === 'dashboard' || (appView === 'focus' && activeTool === 'countdown' && tool.status === 'done'),
  })

  // --- Render ---

  return (
    <main className={`app-shell${appView === 'dashboard' ? ' app-shell-dashboard' : ''}`}>
      <div className="corner-controls">
        <VolumeControl volume={soundVolume} onChange={setSoundVolume} />
        <div className="view-toggle" role="group" aria-label="View mode">
          <button
            type="button"
            aria-pressed={appView === 'dashboard'}
            className={`view-toggle-btn${appView === 'dashboard' ? ' view-toggle-btn-active' : ''}`}
            onClick={() => requestViewSwitch('dashboard')}
          >
            Dashboard
          </button>
          <button
            type="button"
            aria-pressed={appView === 'focus'}
            className={`view-toggle-btn${appView === 'focus' ? ' view-toggle-btn-active' : ''}`}
            onClick={() => requestViewSwitch('focus')}
          >
            Focus
          </button>
        </div>
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
                <ReadoutTapTarget
                  isTappable={isTappable}
                  isRunning={isRunning}
                  expired={tool.readoutBlinking}
                  onTap={handleReadoutTap}
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
                </ReadoutTapTarget>
                <OverrunReadout value={countdown.overrunMs} active={countdown.overrunActive} />
              </div>
            ) : activeTool === 'pomodoro' ? (
              <div className="hero-readout-shell">
                <ReadoutTapTarget
                  isTappable={isTappable}
                  isRunning={isRunning}
                  expired={tool.readoutBlinking}
                  onTap={handleReadoutTap}
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
                </ReadoutTapTarget>
                <PomodoroSessionStepper
                  isIdle={isIdle}
                  currentSession={pomo.state.currentSession}
                  sessionsPerCycle={pomo.sessionsPerCycleDisplay}
                  currentPhase={pomo.state.currentPhase}
                  status={pomo.state.status}
                  onDecrement={decrementSessions}
                  onIncrement={incrementSessions}
                />
              </div>
            ) : (
              <ReadoutTapTarget
                isTappable={isTappable}
                isRunning={isRunning}
                onTap={handleReadoutTap}
              >
                <div className="hero-readout-input">
                  <SplitReadout ms={timer.displayMs} />
                </div>
              </ReadoutTapTarget>
            )}

            <div className="hero-meta">{tool.statusCopy}</div>

            <ProgressRail progress={tool.progress} className="hero-progress" />

            <ToolActionRow
              tool={tool}
              isIdle={isIdle}
              isRunning={isRunning}
              startLabel={`Start ${toolLabel}`}
              className="hero-controls"
            />

            {activeTool === 'timer' && (
              <SplitsPanel splits={timer.state.splits} bodyRef={splitBodyRef} className="hero-splits-list" />
            )}
          </section>
        ) : (
          <DashboardView
            pendingLeave={pendingViewSwitch !== null && appView === 'dashboard'}
            onLeaveConfirmed={handleDashboardLeaveConfirmed}
            onLeaveCancelled={handleDashboardLeaveCancelled}
            onTitleTimersChange={setDashboardTitleTimers}
          />
        )}
      </div>

      {appView === 'focus' && (
        <div className="tool-menu" role="group" aria-label="Timer tools">
          {(['pomodoro', 'countdown', 'timer'] as ToolKind[]).map((t) => (
            <button
              key={t}
              type="button"
              className={`tool-menu-item${t === activeTool ? ' tool-menu-item-active' : ''}`}
              onClick={() => switchTool(t)}
              aria-pressed={t === activeTool}
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
          onCancel={cancelToolSwitch}
        />
      )}

      {appView === 'focus' && pendingViewSwitch && (
        <ConfirmDialog
          message="The active timer will be stopped."
          confirmLabel="Switch"
          onConfirm={confirmFocusViewSwitch}
          onCancel={cancelFocusViewSwitch}
        />
      )}
    </main>
  )
}

export default App
