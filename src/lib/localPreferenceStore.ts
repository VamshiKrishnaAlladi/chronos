interface LocalPreferenceStoreOptions<T> {
  key: string
  defaults: T
  parse: (value: unknown) => T
  serialize?: (value: T) => unknown
  debounceMs?: number
}

export interface LocalPreferenceStore<T> {
  load: () => T
  save: (value: T) => void
  saveSync: (value: T) => void
  clear: () => void
}

export function createLocalPreferenceStore<T>({
  key,
  defaults,
  parse,
  serialize = (value) => value,
  debounceMs = 400,
}: LocalPreferenceStoreOptions<T>): LocalPreferenceStore<T> {
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  let memoryFallback: T | undefined
  let hasMemoryFallback = false
  let lastFailedSerialization: string | null = null
  let removeFailed = false

  function normalize(value: unknown): T {
    try {
      return parse(value)
    } catch {
      return defaults
    }
  }

  function load(): T {
    if (hasMemoryFallback) return memoryFallback as T
    if (typeof window === 'undefined') {
      return defaults
    }

    try {
      const storedValue = window.localStorage.getItem(key)
      return storedValue ? normalize(JSON.parse(storedValue)) : defaults
    } catch {
      return defaults
    }
  }

  function save(value: T): void {
    if (typeof window === 'undefined') {
      return
    }

    if (saveTimer) {
      clearTimeout(saveTimer)
    }

    saveTimer = setTimeout(() => {
      saveTimer = null
      persist(value)
    }, debounceMs)
  }

  function saveSync(value: T): void {
    if (typeof window === 'undefined') return
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    persist(value)
  }

  function persist(value: T): void {
    const normalized = normalize(value)
    let serialized: string
    try {
      const result = JSON.stringify(serialize(normalized))
      if (typeof result !== 'string') throw new TypeError('Preference value is not serializable')
      serialized = result
    } catch {
      memoryFallback = normalized
      hasMemoryFallback = true
      return
    }

    if (lastFailedSerialization === serialized) {
      memoryFallback = normalized
      hasMemoryFallback = true
      return
    }

    try {
      window.localStorage.setItem(key, serialized)
      lastFailedSerialization = null
      removeFailed = false
      hasMemoryFallback = false
      memoryFallback = undefined
    } catch {
      lastFailedSerialization = serialized
      memoryFallback = normalized
      hasMemoryFallback = true
    }
  }

  function clear(): void {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    memoryFallback = defaults
    hasMemoryFallback = true
    lastFailedSerialization = null
    if (typeof window === 'undefined' || removeFailed) return

    try {
      window.localStorage.removeItem(key)
      removeFailed = false
      hasMemoryFallback = false
      memoryFallback = undefined
    } catch {
      removeFailed = true
    }
  }

  return { load, save, saveSync, clear }
}
