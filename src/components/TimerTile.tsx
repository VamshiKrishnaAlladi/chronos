import { useState, useEffect, useCallback, type ReactNode } from 'react'
import type { DashboardTileConfig, ToolFace, ToolStatus } from '../types'
import { TOOL_LABELS } from '../types'
import { formatDuration, msToTimeParts } from '../lib/time'
import { stopCompletionTone } from '../lib/notifications'
import { useCountdown } from '../hooks/useCountdown'
import { useTimer } from '../hooks/useTimer'
import { usePomodoro } from '../hooks/usePomodoro'
import { TileMenu } from './TileMenu'
import {
  ConfirmDialog,
  PauseIcon,
  PlayIcon,
  PomodoroSessionDots,
  TimePartsInput,
} from '.'

export interface TimerTileProps {
  config: DashboardTileConfig
  onConfigChange: (tileId: string, updates: Partial<DashboardTileConfig>) => void
  onRemove: (tileId: string) => void
  onInputsChange: (tileId: string, inputs: Partial<DashboardTileConfig>) => void
  onStatusChange: (tileId: string, status: ToolStatus) => void
  onRemainingMsChange: (tileId: string, ms: number) => void
}

export function TimerTile(props: TimerTileProps) {
  switch (props.config.kind) {
    case 'countdown':
      return <CountdownTileContent {...props} />
    case 'timer':
      return <TimerTileContent {...props} />
    case 'pomodoro':
      return <PomodoroTileContent {...props} />
  }
}

// ---------------------------------------------------------------------------
// Shared card layout
// ---------------------------------------------------------------------------

interface TileCardLayoutProps {
  config: DashboardTileConfig
  tool: ToolFace
  onConfigChange: (tileId: string, updates: Partial<DashboardTileConfig>) => void
  onRemove: (tileId: string) => void
  readoutContent: ReactNode
  inlineReadout?: ReactNode
  extraReadout?: ReactNode
}

function TileCardLayout({
  config,
  tool,
  onConfigChange,
  onRemove,
  readoutContent,
  inlineReadout,
  extraReadout,
}: TileCardLayoutProps) {
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(config.name)
  const [confirmingRemove, setConfirmingRemove] = useState(false)

  useEffect(() => {
    setNameValue(config.name)
  }, [config.name])

  const isIdle = tool.status === 'idle'
  const isRunning = tool.status === 'running'
  const isPaused = tool.status === 'paused'
  const isTappable = isRunning || isPaused

  function commitName() {
    const trimmed = nameValue.trim()
    if (trimmed && trimmed !== config.name) {
      onConfigChange(config.id, { name: trimmed })
    } else {
      setNameValue(config.name)
    }
    setEditingName(false)
  }

  function handleRemoveRequest() {
    if (isRunning || isPaused) {
      setConfirmingRemove(true)
    } else {
      stopCompletionTone()
      onRemove(config.id)
    }
  }

  function confirmRemove() {
    stopCompletionTone()
    onRemove(config.id)
    setConfirmingRemove(false)
  }

  function handleChangeKind(kind: typeof config.kind) {
    const nameIsDefault = config.name === TOOL_LABELS[config.kind]
    onConfigChange(config.id, {
      kind,
      ...(nameIsDefault ? {} : { name: config.name }),
    })
  }

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

  return (
    <div className="tile-card">
      <div className="tile-header">
        {editingName ? (
          <input
            className="tile-name-input"
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitName()
              if (e.key === 'Escape') {
                setNameValue(config.name)
                setEditingName(false)
              }
            }}
            autoFocus
            maxLength={24}
          />
        ) : (
          <button
            type="button"
            className="tile-name"
            onClick={() => {
              setNameValue(config.name)
              setEditingName(true)
            }}
            title="Click to rename"
          >
            {config.name}
          </button>
        )}
        <TileMenu
          currentKind={config.kind}
          status={tool.status}
          onChangeKind={handleChangeKind}
          onRemove={handleRemoveRequest}
        />
      </div>

      <div className="tile-content">
        <div className="tile-readout-row">
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
            {readoutContent}
            {isTappable && (
              <span className="tile-readout-overlay">
                {isRunning ? <PauseIcon /> : <PlayIcon />}
              </span>
            )}
          </div>
          {inlineReadout}
        </div>
        {extraReadout}
        <div className="tile-meta">{tool.statusCopy}</div>
        <div className="tile-progress">
          <span style={{ width: `${tool.progress}%` }} />
        </div>
        <div className="tile-controls">
          {isIdle ? (
            <button
              type="button"
              className="tile-start-button"
              onClick={tool.start}
              disabled={tool.inputInvalid}
            >
              Start Timer
            </button>
          ) : (
            <>
              <button
                type="button"
                className="tile-pill-button tile-pill-button-accent"
                onClick={tool.start}
                disabled={tool.inputInvalid}
              >
                Restart
              </button>
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
      </div>

      {confirmingRemove && (
        <ConfirmDialog
          message={`"${config.name}" is running. Stop and remove?`}
          confirmLabel="Remove"
          onConfirm={confirmRemove}
          onCancel={() => setConfirmingRemove(false)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Countdown tile
// ---------------------------------------------------------------------------

function CountdownTileContent({
  config,
  onConfigChange,
  onRemove,
  onInputsChange,
  onStatusChange,
  onRemainingMsChange,
}: TimerTileProps) {
  const cd = useCountdown(config.inputParts)

  useEffect(() => {
    onInputsChange(config.id, { inputParts: cd.inputParts })
  }, [cd.inputParts, config.id, onInputsChange])

  useEffect(() => {
    onStatusChange(config.id, cd.status)
  }, [cd.status, config.id, onStatusChange])

  useEffect(() => {
    onRemainingMsChange(config.id, cd.state.remainingMs)
  }, [cd.state.remainingMs, config.id, onRemainingMsChange])

  const isIdle = cd.status === 'idle'

  return (
    <TileCardLayout
      config={config}
      tool={cd}
      onConfigChange={onConfigChange}
      onRemove={onRemove}
      readoutContent={
        <div className="tile-readout-input">
          <TimePartsInput
            refs={cd.inputRefs}
            label="HH:MM:SS"
            parts={isIdle ? cd.inputParts : msToTimeParts(cd.displayMs)}
            disabled={!isIdle}
            invalid={isIdle && cd.inputInvalid}
            onPartChange={cd.setInputPart}
            onPartBlur={cd.padInputPart}
            onFocus={stopCompletionTone}
          />
        </div>
      }
      inlineReadout={
        cd.overrunActive ? (
          <span className="tile-overrun">+ {formatDuration(cd.overrunMs)}</span>
        ) : null
      }
    />
  )
}

// ---------------------------------------------------------------------------
// Timer tile
// ---------------------------------------------------------------------------

function TimerTileContent({
  config,
  onConfigChange,
  onRemove,
  onInputsChange,
  onStatusChange,
  onRemainingMsChange,
}: TimerTileProps) {
  const tmr = useTimer(config.inputParts)

  useEffect(() => {
    onInputsChange(config.id, { inputParts: tmr.inputParts })
  }, [tmr.inputParts, config.id, onInputsChange])

  useEffect(() => {
    onStatusChange(config.id, tmr.status)
  }, [tmr.status, config.id, onStatusChange])

  const timerRemainingMs = Math.max(tmr.state.targetMs - tmr.state.mainElapsedMs, 0)
  useEffect(() => {
    onRemainingMsChange(config.id, timerRemainingMs)
  }, [timerRemainingMs, config.id, onRemainingMsChange])

  const isIdle = tmr.status === 'idle'

  return (
    <TileCardLayout
      config={config}
      tool={tmr}
      onConfigChange={onConfigChange}
      onRemove={onRemove}
      readoutContent={
        <div className="tile-readout-input">
          <TimePartsInput
            refs={tmr.inputRefs}
            label="HH:MM:SS"
            parts={isIdle ? tmr.inputParts : msToTimeParts(tmr.displayMs)}
            disabled={!isIdle}
            invalid={isIdle && tmr.inputInvalid}
            onPartChange={tmr.setInputPart}
            onPartBlur={tmr.padInputPart}
            onFocus={stopCompletionTone}
          />
        </div>
      }
    />
  )
}

// ---------------------------------------------------------------------------
// Pomodoro tile
// ---------------------------------------------------------------------------

const handleStopTone = stopCompletionTone

function PomodoroTileContent({
  config,
  onConfigChange,
  onRemove,
  onInputsChange,
  onStatusChange,
  onRemainingMsChange,
}: TimerTileProps) {
  const pomo = usePomodoro(config.inputParts, config.breakInputParts, config.sessionsInput)

  useEffect(() => {
    onInputsChange(config.id, {
      inputParts: pomo.workInputParts,
      breakInputParts: pomo.breakInputParts,
      sessionsInput: pomo.sessionsInput,
    })
  }, [pomo.workInputParts, pomo.breakInputParts, pomo.sessionsInput, config.id, onInputsChange])

  useEffect(() => {
    onStatusChange(config.id, pomo.status)
  }, [pomo.status, config.id, onStatusChange])

  useEffect(() => {
    onRemainingMsChange(config.id, pomo.state.remainingMs)
  }, [pomo.state.remainingMs, config.id, onRemainingMsChange])

  const incrementSessions = useCallback(() => {
    const n = Number(pomo.sessionsInput)
    if (Number.isInteger(n) && n < 99) {
      pomo.setSessionsInput(String(n + 1))
    }
  }, [pomo.sessionsInput, pomo.setSessionsInput])

  const decrementSessions = useCallback(() => {
    const n = Number(pomo.sessionsInput)
    if (Number.isInteger(n) && n > 1) {
      pomo.setSessionsInput(String(n - 1))
    }
  }, [pomo.sessionsInput, pomo.setSessionsInput])

  const isIdle = pomo.status === 'idle'

  return (
    <TileCardLayout
      config={config}
      tool={pomo}
      onConfigChange={onConfigChange}
      onRemove={onRemove}
      readoutContent={
        isIdle ? (
          <div className="tile-pomo-idle">
            <span className="tile-pomo-label">Work</span>
            <div className="tile-readout-input">
              <TimePartsInput
                refs={pomo.workRefs}
                label="Work"
                parts={pomo.workInputParts}
                disabled={false}
                invalid={pomo.workInvalid}
                onPartChange={pomo.setWorkPart}
                onPartBlur={pomo.padWorkPart}
                onFocus={handleStopTone}
              />
            </div>
            <span className="tile-pomo-label">Break</span>
            <div className="tile-readout-input tile-readout-input-sm">
              <TimePartsInput
                refs={pomo.breakRefs}
                label="Break"
                parts={pomo.breakInputParts}
                disabled={false}
                invalid={pomo.breakInvalid}
                onPartChange={pomo.setBreakPart}
                onPartBlur={pomo.padBreakPart}
                onFocus={handleStopTone}
              />
            </div>
          </div>
        ) : (
          <div className="tile-readout-input">
            <TimePartsInput
              refs={pomo.workRefs}
              label="HH:MM:SS"
              parts={msToTimeParts(pomo.displayMs)}
              disabled={true}
              invalid={false}
              onPartChange={pomo.setWorkPart}
              onPartBlur={pomo.padWorkPart}
              onFocus={handleStopTone}
            />
          </div>
        )
      }
      extraReadout={
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
      }
    />
  )
}
