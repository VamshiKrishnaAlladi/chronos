interface LocalPreferenceStoreOptions<T> {
  key: string
  defaults: T
  parse: (value: unknown) => T
  debounceMs?: number
}

export interface LocalPreferenceStore<T> {
  load: () => T
  save: (value: T) => void
  saveSync: (value: T) => void
}

export function createLocalPreferenceStore<T>({
  key,
  defaults,
  parse,
  debounceMs = 400,
}: LocalPreferenceStoreOptions<T>): LocalPreferenceStore<T> {
  let saveTimer: ReturnType<typeof setTimeout> | null = null

  function load(): T {
    if (typeof window === 'undefined') {
      return defaults
    }

    const storedValue = window.localStorage.getItem(key)
    if (!storedValue) {
      return defaults
    }

    try {
      return parse(JSON.parse(storedValue))
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
      window.localStorage.setItem(key, JSON.stringify(value))
      saveTimer = null
    }, debounceMs)
  }

  function saveSync(value: T): void {
    if (typeof window === 'undefined') return
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    window.localStorage.setItem(key, JSON.stringify(value))
  }

  return { load, save, saveSync }
}
