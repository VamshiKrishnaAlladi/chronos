import { describe, expect, it, vi } from 'vitest'
import {
  DASHBOARD_PREFERENCES_VERSION,
  createDefaultTileConfig,
  parseDashboardPreferences,
} from './dashboardPreferences'

describe('dashboard preference parsing', () => {
  it('keeps only valid tiles and caps them at four', () => {
    const prefs = parseDashboardPreferences({
      tiles: [
        { id: '1', kind: 'countdown' },
        { id: '2', kind: 'timer' },
        { id: '3', kind: 'pomodoro' },
        { id: '4', kind: 'countdown' },
        { id: '5', kind: 'timer' },
        { id: 'bad', kind: 'unknown' },
      ],
    })

    expect(prefs.tiles).toHaveLength(4)
    expect(prefs.tiles.map(tile => tile.id)).toEqual(['1', '2', '3', '4'])
  })

  it('repairs invalid tile time parts with kind defaults', () => {
    const prefs = parseDashboardPreferences({
      tiles: [
        {
          id: '1',
          kind: 'countdown',
          inputParts: { hours: '00', minutes: '99', seconds: '00' },
        },
      ],
    })

    expect(prefs.tiles[0].inputParts).toEqual({ hours: '00', minutes: '25', seconds: '00' })
  })

  it('migrates legacy data and rejects unsupported future envelopes', () => {
    expect(parseDashboardPreferences({ tiles: [{ id: 'legacy', kind: 'timer' }] }).tiles).toHaveLength(1)
    expect(parseDashboardPreferences({
      version: DASHBOARD_PREFERENCES_VERSION,
      data: { tiles: [{ id: 'current', kind: 'timer' }] },
    }).tiles[0].id).toBe('current')
    expect(parseDashboardPreferences({
      version: DASHBOARD_PREFERENCES_VERSION + 1,
      data: { tiles: [{ id: 'future', kind: 'timer' }] },
    }).tiles).toEqual([])
  })

  it('sanitizes names, IDs, duplicate tiles, and session counts', () => {
    const prefs = parseDashboardPreferences({
      tiles: [
        { id: ' tile-a ', kind: 'pomodoro', name: '  Focus\u0000 session  ', sessionsInput: '00' },
        { id: 'tile-a', kind: 'timer' },
        { id: 'bad id', kind: 'countdown' },
      ],
    })
    expect(prefs.tiles).toHaveLength(1)
    expect(prefs.tiles[0]).toMatchObject({ id: 'tile-a', name: 'Focus session', sessionsInput: '4' })
  })

  it('uses random UUIDs and keeps the fallback unique when UUID generation fails', () => {
    const randomUUID = vi.spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce('11111111-1111-4111-8111-111111111111')
    expect(createDefaultTileConfig('timer').id).toBe('tile-11111111-1111-4111-8111-111111111111')

    randomUUID.mockImplementation(() => { throw new Error('unavailable') })
    const now = vi.spyOn(Date, 'now').mockReturnValue(123)
    const first = createDefaultTileConfig('timer').id
    const second = createDefaultTileConfig('timer').id
    expect(first).not.toBe(second)
    expect(first).toMatch(/^tile-[a-z0-9]+-[a-z0-9]+$/)
    now.mockRestore()
    randomUUID.mockRestore()
  })
})
