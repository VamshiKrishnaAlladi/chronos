import { describe, expect, it } from 'vitest'
import { parseStoredPreferences } from './preferences'

describe('stored preferences parsing', () => {
  it('falls back safely for malformed preference fields', () => {
    const prefs = parseStoredPreferences({
      activeTool: 'unknown',
      appView: 'other',
      countdownInputParts: { hours: '00', minutes: '70', seconds: '00' },
      soundVolume: 57,
    })

    expect(prefs.activeTool).toBe('countdown')
    expect(prefs.appView).toBe('focus')
    expect(prefs.countdownInputParts).toEqual({ hours: '00', minutes: '25', seconds: '00' })
    expect(prefs.soundVolume).toBe(60)
  })

  it('maps legacy muted preferences to zero volume', () => {
    const prefs = parseStoredPreferences({ soundMuted: true })

    expect(prefs.soundVolume).toBe(0)
  })
})
