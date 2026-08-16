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

  it('survives blocked reads and quota errors while retaining the latest value in memory', () => {
    const store = createLocalPreferenceStore({
      key: 'blocked-store',
      defaults: { value: 0 },
      parse: (value) => value as { value: number },
    })
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError')
    })
    expect(store.load()).toEqual({ value: 0 })
    getItem.mockRestore()

    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Full', 'QuotaExceededError')
    })
    expect(() => store.saveSync({ value: 7 })).not.toThrow()
    expect(store.load()).toEqual({ value: 7 })
    store.saveSync({ value: 7 })
    expect(setItem).toHaveBeenCalledTimes(1)
    setItem.mockRestore()
  })

  it('handles serialization and removal failures without losing session continuity', () => {
    const store = createLocalPreferenceStore<unknown>({
      key: 'fragile-store',
      defaults: null,
      parse: (value) => value,
    })
    const circular: { self?: unknown } = {}
    circular.self = circular
    expect(() => store.saveSync(circular)).not.toThrow()
    expect(store.load()).toBe(circular)

    const removeItem = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError')
    })
    expect(() => store.clear()).not.toThrow()
    expect(store.load()).toBeNull()
    removeItem.mockRestore()
  })
})
