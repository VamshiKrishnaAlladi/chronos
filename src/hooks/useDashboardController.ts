import { useCallback, useEffect, useRef, useState } from 'react'
import type { DashboardTileConfig, PageTitleTimer, ToolKind, ToolStatus } from '../types'
import { MAX_DASHBOARD_TILES } from '../types'
import { stopCompletionTone } from '../lib/notifications'
import {
  createDefaultTileConfig,
  loadDashboardPreferences,
  saveDashboardPreferences,
  saveDashboardPreferencesSync,
} from '../lib/dashboardPreferences'

interface UseDashboardControllerOptions {
  pendingLeave: boolean
  onLeaveConfirmed: () => void
  onLeaveCancelled: () => void
  onTitleTimersChange: (timers: PageTitleTimer[]) => void
}

export function useDashboardController({
  pendingLeave,
  onLeaveConfirmed,
  onLeaveCancelled,
  onTitleTimersChange,
}: UseDashboardControllerOptions) {
  const [tiles, setTiles] = useState<DashboardTileConfig[]>(() => loadDashboardPreferences().tiles)
  const [hasActiveTile, setHasActiveTile] = useState(false)

  const tilesRef = useRef(tiles)
  const tileInputsRef = useRef<Record<string, Partial<DashboardTileConfig>>>({})
  const tileStatusesRef = useRef<Record<string, ToolStatus>>({})
  const tileTitleTimersRef = useRef<Record<string, PageTitleTimer>>({})
  const onLeaveConfirmedRef = useRef(onLeaveConfirmed)

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

  const recomputeActiveTimers = useCallback(() => {
    const active: PageTitleTimer[] = []
    let nextHasActiveTile = false

    for (const tile of tilesRef.current) {
      const status = tileStatusesRef.current[tile.id]
      const timer = tileTitleTimersRef.current[tile.id]
      if (status === 'running' || status === 'paused') {
        nextHasActiveTile = true
      }
      if (!timer) continue

      const showRemaining = (status === 'running' || status === 'paused') && !timer.overrun && timer.ms > 0
      const showOverrun = status === 'done' && timer.overrun
      if (showRemaining || showOverrun) {
        active.push(timer)
      }
    }

    onTitleTimersChange(active)
    setHasActiveTile(nextHasActiveTile)
  }, [onTitleTimersChange])

  useEffect(() => {
    tilesRef.current = tiles
    triggerSave()
  }, [tiles, triggerSave])

  useEffect(() => {
    onLeaveConfirmedRef.current = onLeaveConfirmed
  }, [onLeaveConfirmed])

  useEffect(() => {
    window.addEventListener('beforeunload', flushSave)
    return () => {
      window.removeEventListener('beforeunload', flushSave)
      flushSave()
    }
  }, [flushSave])

  useEffect(() => {
    return () => onTitleTimersChange([])
  }, [onTitleTimersChange])

  useEffect(() => {
    if (pendingLeave && !hasActiveTile) {
      onLeaveConfirmedRef.current()
    }
  }, [pendingLeave, hasActiveTile])

  const handleConfigChange = useCallback((tileId: string, updates: Partial<DashboardTileConfig>) => {
    if (updates.kind) {
      delete tileInputsRef.current[tileId]
      delete tileStatusesRef.current[tileId]
      delete tileTitleTimersRef.current[tileId]
    }
    setTiles(prev => {
      const next = prev.map(tile => {
        if (tile.id !== tileId) return tile
        if (updates.kind && updates.kind !== tile.kind) {
          const defaults = createDefaultTileConfig(updates.kind)
          return { ...defaults, id: tile.id, name: updates.name ?? defaults.name }
        }
        return { ...tile, ...updates }
      })
      tilesRef.current = next
      return next
    })
    recomputeActiveTimers()
  }, [recomputeActiveTimers])

  const handleRemove = useCallback((tileId: string) => {
    delete tileInputsRef.current[tileId]
    delete tileStatusesRef.current[tileId]
    delete tileTitleTimersRef.current[tileId]
    setTiles(prev => {
      const next = prev.filter(t => t.id !== tileId)
      tilesRef.current = next
      return next
    })
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

  function confirmLeave() {
    stopCompletionTone()
    onLeaveConfirmedRef.current()
  }

  function cancelLeave() {
    onLeaveCancelled()
  }

  return {
    tiles,
    showLeaveConfirm: pendingLeave && hasActiveTile,
    handleConfigChange,
    handleRemove,
    handleInputsChange,
    handleStatusChange,
    handleTitleTimerChange,
    handleAddTile,
    confirmLeave,
    cancelLeave,
  }
}
