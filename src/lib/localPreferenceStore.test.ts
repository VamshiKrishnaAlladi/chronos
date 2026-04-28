import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLocalPreferenceStore } from './localPreferenceStore'

describe('local preference store', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('debounces saves and writes the latest value', () => {
    const store = createLocalPreferenceStore({
      key: 'test-store',
      defaults: { value: 0 },
      parse: (value) => value as { value: number },
    })

    store.save({ value: 1 })
    store.save({ value: 2 })
    expect(window.localStorage.getItem('test-store')).toBeNull()

    vi.advanceTimersByTime(400)
    expect(window.localStorage.getItem('test-store')).toBe(JSON.stringify({ value: 2 }))
  })

  it('falls back to defaults when stored JSON is invalid', () => {
    const store = createLocalPreferenceStore({
      key: 'test-store',
      defaults: { value: 0 },
      parse: (value) => value as { value: number },
    })
    window.localStorage.setItem('test-store', '{')

    expect(store.load()).toEqual({ value: 0 })
  })
})
