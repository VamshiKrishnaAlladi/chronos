import { useState, useRef, useCallback, useEffect, type RefObject } from 'react'
import type { DashboardTileConfig, PageTitleTimer, ToolKind, ToolStatus } from '../types'
import { MAX_DASHBOARD_TILES, TOOL_LABELS } from '../types'
import { stopCompletionTone } from '../lib/notifications'
import {
  loadDashboardPreferences,
  saveDashboardPreferences,
  saveDashboardPreferencesSync,
  createDefaultTileConfig,
} from '../lib/dashboardPreferences'
import { TimerTile } from './TimerTile'
import { ConfirmDialog } from '.'

const STORED_DASHBOARD = loadDashboardPreferences()

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
    return () => document.removeEventListener('pointerdown', handleClickOutside)
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
    return () => document.removeEventListener('pointerdown', handleClickOutside)
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
  activeTimersRef: RefObject<PageTitleTimer[]>
}

export function DashboardView({ pendingLeave, onLeaveConfirmed, onLeaveCancelled, activeTimersRef }: DashboardViewProps) {
  const [tiles, setTiles] = useState<DashboardTileConfig[]>(STORED_DASHBOARD.tiles)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)

  const tilesRef = useRef(tiles)
  tilesRef.current = tiles

  const tileInputsRef = useRef<Record<string, Partial<DashboardTileConfig>>>({})
  const tileStatusesRef = useRef<Record<string, ToolStatus>>({})
  const tileTitleTimersRef = useRef<Record<string, PageTitleTimer>>({})

  const onLeaveConfirmedRef = useRef(onLeaveConfirmed)
  onLeaveConfirmedRef.current = onLeaveConfirmed

  // --- Persistence ---

  const flushSave = useCallback(() => {
    const merged = tilesRef.current.map(tile => ({
      ...tile,
      ...(tileInputsRef.current[tile.id] || {}),
    }))
    saveDashboardPreferencesSync({ tiles: merged })
  }, [])

  const triggerSave = useCallback(() => {
    const merged = tilesRef.current.map(tile => ({
      ...tile,
      ...(tileInputsRef.current[tile.id] || {}),
    }))
    saveDashboardPreferences({ tiles: merged })
  }, [])

  useEffect(() => {
    triggerSave()
  }, [tiles, triggerSave])

  useEffect(() => {
    window.addEventListener('beforeunload', flushSave)
    return () => {
      window.removeEventListener('beforeunload', flushSave)
      flushSave()
    }
  }, [flushSave])

  // --- Leave confirmation ---

  useEffect(() => {
    if (!pendingLeave) {
      setShowLeaveConfirm(false)
      return
    }
    const anyRunning = Object.values(tileStatusesRef.current).some(
      s => s === 'running' || s === 'paused',
    )
    if (!anyRunning) {
      onLeaveConfirmedRef.current()
      return
    }
    setShowLeaveConfirm(true)
  }, [pendingLeave])

  function confirmLeave() {
    stopCompletionTone()
    setShowLeaveConfirm(false)
    onLeaveConfirmedRef.current()
  }

  function cancelLeave() {
    setShowLeaveConfirm(false)
    onLeaveCancelled()
  }

  // --- Active timers bookkeeping ---

  const recomputeActiveTimers = useCallback(() => {
    const active: PageTitleTimer[] = []
    for (const tile of tilesRef.current) {
      const status = tileStatusesRef.current[tile.id]
      const timer = tileTitleTimersRef.current[tile.id]
      if (!timer) continue

      const showRemaining = (status === 'running' || status === 'paused') && !timer.overrun && timer.ms > 0
      const showOverrun = status === 'done' && timer.overrun
      if (showRemaining || showOverrun) {
        active.push(timer)
      }
    }
    activeTimersRef.current = active
  }, [activeTimersRef])

  useEffect(() => {
    return () => { activeTimersRef.current = [] }
  }, [activeTimersRef])

  // --- Tile callbacks (stable via useCallback + refs) ---

  const handleConfigChange = useCallback((tileId: string, updates: Partial<DashboardTileConfig>) => {
    if (updates.kind) {
      delete tileInputsRef.current[tileId]
      delete tileStatusesRef.current[tileId]
      delete tileTitleTimersRef.current[tileId]
    }
    setTiles(prev =>
      prev.map(tile => {
        if (tile.id !== tileId) return tile
        if (updates.kind && updates.kind !== tile.kind) {
          const defaults = createDefaultTileConfig(updates.kind)
          return { ...defaults, id: tile.id, name: updates.name ?? defaults.name }
        }
        return { ...tile, ...updates }
      }),
    )
    recomputeActiveTimers()
  }, [recomputeActiveTimers])

  const handleRemove = useCallback((tileId: string) => {
    delete tileInputsRef.current[tileId]
    delete tileStatusesRef.current[tileId]
    delete tileTitleTimersRef.current[tileId]
    setTiles(prev => prev.filter(t => t.id !== tileId))
    recomputeActiveTimers()
  }, [recomputeActiveTimers])

  const handleInputsChange = useCallback(
    (tileId: string, inputs: Partial<DashboardTileConfig>) => {
      tileInputsRef.current[tileId] = inputs
      triggerSave()
    },
    [triggerSave],
  )

  const handleStatusChange = useCallback((tileId: string, status: ToolStatus) => {
    tileStatusesRef.current[tileId] = status
    recomputeActiveTimers()
  }, [recomputeActiveTimers])

  const handleTitleTimerChange = useCallback((tileId: string, timer: PageTitleTimer) => {
    tileTitleTimersRef.current[tileId] = timer
    recomputeActiveTimers()
  }, [recomputeActiveTimers])

  const handleAddTile = useCallback((kind: ToolKind) => {
    setTiles(prev => {
      if (prev.length >= MAX_DASHBOARD_TILES) return prev
      return [...prev, createDefaultTileConfig(kind)]
    })
  }, [])

  // --- Render ---

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
