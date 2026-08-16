import { describe, expect, it } from 'vitest'
import { PREFERENCES_VERSION, parseStoredPreferences } from './preferences'

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
    expect(prefs.keepAwake).toBe(false)
  })

  it('maps legacy muted preferences to zero volume', () => {
    const prefs = parseStoredPreferences({ soundMuted: true })

    expect(prefs.soundVolume).toBe(0)
  })

  it('restores the opt-in keep-awake preference only from a boolean true', () => {
    expect(parseStoredPreferences({ keepAwake: true }).keepAwake).toBe(true)
    expect(parseStoredPreferences({ keepAwake: 'true' }).keepAwake).toBe(false)
  })

  it('migrates legacy raw values, accepts the current envelope, and rejects future versions', () => {
    expect(parseStoredPreferences({ activeTool: 'timer' }).activeTool).toBe('timer')
    expect(parseStoredPreferences({
      version: PREFERENCES_VERSION,
      data: { activeTool: 'pomodoro', pomoSessionsInput: '08' },
    })).toMatchObject({ activeTool: 'pomodoro', pomoSessionsInput: '8' })
    expect(parseStoredPreferences({
      version: PREFERENCES_VERSION + 1,
      data: { activeTool: 'timer' },
    }).activeTool).toBe('countdown')
  })

  it('validates session counts at the persistence boundary', () => {
    expect(parseStoredPreferences({ pomoSessionsInput: '00' }).pomoSessionsInput).toBe('4')
    expect(parseStoredPreferences({ pomoSessionsInput: '99' }).pomoSessionsInput).toBe('99')
  })
})
