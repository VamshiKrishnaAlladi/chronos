import { useState, useRef, useEffect } from 'react'
import type { PageTitleTimer, ToolKind } from '../types'
import { MAX_DASHBOARD_TILES, TOOL_LABELS } from '../types'
import { TimerTile } from './TimerTile'
import { ConfirmDialog } from '.'
import { useDashboardController } from '../hooks/useDashboardController'

// ---------------------------------------------------------------------------
// Add-tile card
// ---------------------------------------------------------------------------

function AddTileFab({ onAdd }: { onAdd: (kind: ToolKind) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', handleClickOutside)
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  return (
    <div className="dashboard-fab" ref={ref}>
      <button
        type="button"
        className="dashboard-fab-btn"
        onClick={() => setOpen(v => !v)}
        aria-label="Add timer"
      >
        Add Timer
      </button>
      {open && (
        <div className="fab-menu-dropdown" role="menu">
          {(['countdown', 'timer', 'pomodoro'] as ToolKind[]).map(kind => (
            <button
              key={kind}
              type="button"
              className="add-menu-option"
              role="menuitem"
              onClick={() => {
                onAdd(kind)
                setOpen(false)
              }}
            >
              {TOOL_LABELS[kind]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function EmptyState({ onAdd }: { onAdd: (kind: ToolKind) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', handleClickOutside)
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  return (
    <div className="dashboard-empty" ref={ref}>
      <div className="dashboard-empty-anchor">
        <button
          type="button"
          className="dashboard-empty-btn"
          onClick={() => setOpen(v => !v)}
          aria-label="Add timer"
        >
          <span className="dashboard-empty-icon">+</span>
          <span className="dashboard-empty-label">Add your first timer</span>
        </button>
        {open && (
          <div className="add-menu-dropdown" role="menu">
            {(['countdown', 'timer', 'pomodoro'] as ToolKind[]).map(kind => (
              <button
                key={kind}
                type="button"
                className="add-menu-option"
                role="menuitem"
                onClick={() => {
                  onAdd(kind)
                  setOpen(false)
                }}
              >
                {TOOL_LABELS[kind]}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DashboardView
// ---------------------------------------------------------------------------

interface DashboardViewProps {
  pendingLeave: boolean
  onLeaveConfirmed: () => void
  onLeaveCancelled: () => void
  onTitleTimersChange: (timers: PageTitleTimer[]) => void
}

export function DashboardView({ pendingLeave, onLeaveConfirmed, onLeaveCancelled, onTitleTimersChange }: DashboardViewProps) {
  const {
    tiles,
    showLeaveConfirm,
    handleConfigChange,
    handleRemove,
    handleInputsChange,
    handleStatusChange,
    handleTitleTimerChange,
    handleAddTile,
    confirmLeave,
    cancelLeave,
  } = useDashboardController({
    pendingLeave,
    onLeaveConfirmed,
    onLeaveCancelled,
    onTitleTimersChange,
  })

  return (
    <div className="dashboard-view">
      {tiles.length === 0 ? (
        <EmptyState onAdd={handleAddTile} />
      ) : (
        <div className="dashboard-grid" data-count={tiles.length}>
          {tiles.map(tile => (
            <TimerTile
              key={tile.id}
              config={tile}
              onConfigChange={handleConfigChange}
              onRemove={handleRemove}
              onInputsChange={handleInputsChange}
              onStatusChange={handleStatusChange}
              onTitleTimerChange={handleTitleTimerChange}
            />
          ))}
        </div>
      )}

      {tiles.length > 0 && tiles.length < MAX_DASHBOARD_TILES && (
        <AddTileFab onAdd={handleAddTile} />
      )}

      {showLeaveConfirm && (
        <ConfirmDialog
          message="All running dashboard timers will be stopped."
          confirmLabel="Switch"
          onConfirm={confirmLeave}
          onCancel={cancelLeave}
        />
      )}
    </div>
  )
}
