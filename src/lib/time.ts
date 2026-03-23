import dayjs from 'dayjs'
import type { TimeParts, TimePartKey } from '../types'

export function splitTimeParts(value: string): TimeParts {
  const [hours = '00', minutes = '00', seconds = '00'] = value.split(':')
  return { hours, minutes, seconds }
}

export function padTimePart(value: string): string {
  if (!/^\d{0,2}$/.test(value)) {
    return '00'
  }

  return value.padStart(2, '0')
}

export function normalizeTimeParts(parts: TimeParts): TimeParts {
  return {
    hours: padTimePart(parts.hours),
    minutes: padTimePart(parts.minutes),
    seconds: padTimePart(parts.seconds),
  }
}

export function isValidTimeParts(parts: TimeParts): boolean {
  if (![parts.hours, parts.minutes, parts.seconds].every((part) => /^\d{1,2}$/.test(part))) {
    return false
  }

  const normalizedParts = normalizeTimeParts(parts)
  const minutes = Number(normalizedParts.minutes)
  const seconds = Number(normalizedParts.seconds)
  return minutes < 60 && seconds < 60
}

export function parseHmsInput(value: string): number {
  const parts = splitTimeParts(value)
  if (!isValidTimeParts(parts)) {
    return 0
  }

  return timePartsToMs(normalizeTimeParts(parts))
}

export function timePartsToMs(parts: TimeParts): number {
  const hours = Number(parts.hours)
  const minutes = Number(parts.minutes)
  const seconds = Number(parts.seconds)
  return hours * 3600_000 + minutes * 60_000 + seconds * 1000
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(Math.floor(ms / 1000), 0)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return [hours, minutes, seconds].map((value) => value.toString().padStart(2, '0')).join(':')
}

export function formatClockTime(timestamp: number): string {
  return dayjs(timestamp).format('hh:mm:ss A')
}

export function isStoredTimeParts(value: unknown): value is TimeParts {
  if (!value || typeof value !== 'object') {
    return false
  }

  const parts = value as Record<string, unknown>
  return (['hours', 'minutes', 'seconds'] as TimePartKey[]).every(
    (partKey) => typeof parts[partKey] === 'string' && /^\d{0,2}$/.test(parts[partKey] as string),
  )
}

export function parseStoredTimeParts(value: unknown, fallback: string): TimeParts {
  if (!isStoredTimeParts(value)) {
    return splitTimeParts(fallback)
  }

  return { ...value }
}
