import { describe, expect, it } from 'vitest'
import { parseDashboardPreferences } from './dashboardPreferences'

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
})
