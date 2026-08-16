export interface VersionedPayload<T> {
  version: number
  data: T
}

interface ParsedPayload {
  data: unknown
  legacy: boolean
  supported: boolean
}

/**
 * Reads the common persistence envelope. Values without a version are the
 * original Chronos v1 shape and are intentionally treated as migratable.
 */
export function parseVersionedPayload(value: unknown, currentVersion: number): ParsedPayload {
  if (!isRecord(value) || !Object.prototype.hasOwnProperty.call(value, 'version')) {
    return { data: value, legacy: true, supported: true }
  }

  if (value.version !== currentVersion || !Object.prototype.hasOwnProperty.call(value, 'data')) {
    return { data: undefined, legacy: false, supported: false }
  }

  return { data: value.data, legacy: false, supported: true }
}

export function createVersionedPayload<T>(version: number, data: T): VersionedPayload<T> {
  return { version, data }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseSessionsInput(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || !/^\d{1,2}$/.test(value)) return fallback
  const sessions = Number(value)
  return Number.isInteger(sessions) && sessions >= 1 && sessions <= 99 ? String(sessions) : fallback
}

export function parseStorageId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const id = value.trim()
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(id) ? id : null
}

export function parseTileName(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  const name = Array.from(value.trim())
    .filter((character) => character >= ' ' && character !== '\u007f')
    .join('')
  return name ? name.slice(0, 24) : fallback
}
