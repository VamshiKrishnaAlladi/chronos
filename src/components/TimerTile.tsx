import { useState, useEffect, useCallback, type ReactNode } from 'react'
import type { DashboardTileConfig, ToolFace, ToolStatus } from '../types'
import { TOOL_LABELS } from '../types'
import { formatDuration } from '../lib/time'
import { stopCompletionTone } from '../lib/notifications'
import { DEFAULT_POMODORO_SESSIONS } from '../lib/preferences'
import { useCountdown } from '../hooks/useCountdown'
import { useTimer } from '../hooks/useTimer'
import { usePomodoro } from '../hooks/usePomodoro'
import { TileMenu } from './TileMenu'
import {
  ConfirmDialog,
  IconButton,
  PauseIcon,
  PlayIcon,
  PomodoroSessionDots,
  RestartIcon,
  ResumeIcon,
  StopIcon,
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
  inlineReadout?: ReactNode
  extraReadout?: ReactNode
  inputs: ReactNode
}

function TileCardLayout({
  config,
  tool,
  onConfigChange,
  onRemove,
  inlineReadout,
  extraReadout,
  inputs,
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
          <div className={`tile-readout${tool.readoutBlinking ? ' tile-readout-expired' : ''}`}>
            {formatDuration(tool.displayMs)}
          </div>
          {inlineReadout}
        </div>
        {extraReadout}
        <div className="tile-meta">{tool.statusCopy}</div>
        <div className="tile-progress">
          <span style={{ width: `${tool.progress}%` }} />
        </div>
        <div className="tile-controls">
          <IconButton
            label={isIdle ? 'Start' : 'Restart'}
            onClick={tool.start}
            disabled={tool.inputInvalid}
          >
            {isIdle ? <PlayIcon /> : <RestartIcon />}
          </IconButton>
          <IconButton
            label={isPaused ? 'Resume' : 'Pause'}
            onClick={isPaused ? tool.resume : tool.pause}
            disabled={!isRunning && !isPaused}
          >
            {isPaused ? <ResumeIcon /> : <PauseIcon />}
          </IconButton>
          <IconButton label="Stop" onClick={tool.stop} disabled={isIdle}>
            <StopIcon />
          </IconButton>
        </div>
        <div className="tile-inputs">{inputs}</div>
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

  return (
    <TileCardLayout
      config={config}
      tool={cd}
      onConfigChange={onConfigChange}
      onRemove={onRemove}
      inlineReadout={
        cd.overrunActive ? (
          <span className="tile-overrun">+ {formatDuration(cd.overrunMs)}</span>
        ) : null
      }
      inputs={
        <TimePartsInput
          refs={cd.inputRefs}
          label="HH:MM:SS"
          parts={cd.inputParts}
          disabled={cd.inputDisabled}
          invalid={cd.inputInvalid}
          onPartChange={cd.setInputPart}
          onPartBlur={cd.padInputPart}
          onFocus={stopCompletionTone}
        />
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

  return (
    <TileCardLayout
      config={config}
      tool={tmr}
      onConfigChange={onConfigChange}
      onRemove={onRemove}
      inputs={
        <TimePartsInput
          refs={tmr.inputRefs}
          label="HH:MM:SS"
          parts={tmr.inputParts}
          disabled={tmr.inputDisabled}
          invalid={tmr.inputInvalid}
          onPartChange={tmr.setInputPart}
          onPartBlur={tmr.padInputPart}
          onFocus={stopCompletionTone}
        />
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

  const onSessionsChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      pomo.setSessionsInput(e.target.value.replace(/\D/g, '').slice(0, 2))
    },
    [pomo.setSessionsInput],
  )

  const onSessionsBlur = useCallback(() => {
    const n = Number(pomo.sessionsInput)
    if (pomo.sessionsInput === '' || !Number.isInteger(n) || n < 1) {
      pomo.setSessionsInput(DEFAULT_POMODORO_SESSIONS)
    }
  }, [pomo.sessionsInput, pomo.setSessionsInput])

  return (
    <TileCardLayout
      config={config}
      tool={pomo}
      onConfigChange={onConfigChange}
      onRemove={onRemove}
      extraReadout={
        <PomodoroSessionDots
          currentSession={pomo.state.currentSession}
          sessionsPerCycle={pomo.sessionsPerCycleDisplay}
          currentPhase={pomo.state.currentPhase}
          status={pomo.state.status}
        />
      }
      inputs={
        <div className="tile-pomo-inputs">
          <TimePartsInput
            refs={pomo.workRefs}
            label="Work"
            parts={pomo.workInputParts}
            disabled={pomo.inputDisabled}
            invalid={pomo.workInvalid}
            onPartChange={pomo.setWorkPart}
            onPartBlur={pomo.padWorkPart}
            onFocus={handleStopTone}
          />
          <TimePartsInput
            refs={pomo.breakRefs}
            label="Break"
            parts={pomo.breakInputParts}
            disabled={pomo.inputDisabled}
            invalid={pomo.breakInvalid}
            onPartChange={pomo.setBreakPart}
            onPartBlur={pomo.padBreakPart}
            onFocus={handleStopTone}
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
                disabled={pomo.inputDisabled}
                maxLength={2}
                onFocus={(e) => {
                  handleStopTone()
                  e.currentTarget.select()
                }}
                onChange={onSessionsChange}
                onBlur={onSessionsBlur}
              />
            </div>
          </label>
        </div>
      }
    />
  )
}
