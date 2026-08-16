import type {
  CountdownState,
  PomodoroPhase,
  PomodoroState,
  Split,
  TimerState,
  ToolKind,
  ToolStatus,
} from '../types'
import { isRecord, parseStorageId } from './persistenceSchema'

const RUNTIME_SESSIONS_STORAGE_KEY = 'chronos-runtime-sessions-v1'
export const RUNTIME_SESSIONS_VERSION = 1
const MAX_TIMER_INPUT_MS = 359_999_000
const MAX_POMODORO_SESSIONS = 99
const MAX_SPLITS = 10_000
const MAX_STORED_SESSIONS = 32

let memoryStore: RuntimeSessionsStore | null = null
let lastFailedSerialization: string | null = null
let removeFailed = false

interface StoredRuntimeSession {
  kind: ToolKind
  state: unknown
}

interface RuntimeSessionsStore {
  version: typeof RUNTIME_SESSIONS_VERSION
  sessions: Record<string, StoredRuntimeSession>
}

export function focusRuntimeSessionId(kind: ToolKind): string {
  return `focus:${kind}`
}

export function dashboardRuntimeSessionId(tileId: string): string {
  return `dashboard:${tileId}`
}

export function loadCountdownRuntimeSession(
  sessionId: string,
  fallback: CountdownState,
  now = Date.now(),
): CountdownState {
  if (!isRuntimeSessionId(sessionId)) return fallback
  const raw = loadSession(sessionId, 'countdown')
  if (!isRecord(raw)) return fallback

  const durationMs = positiveNumber(raw.durationMs)
  const remainingMs = nonNegativeNumber(raw.remainingMs)
  const overrunMs = nonNegativeNumber(raw.overrunMs)
  const status = parseStatus(raw.status)
  const endsAt = nullableNumber(raw.endsAt)
  const completedAt = nullableNumber(raw.completedAt)
  const alertedAt = nullableNumber(raw.alertedAt)

  if (
    durationMs === null ||
    remainingMs === null ||
    overrunMs === null ||
    status === null ||
    endsAt === undefined ||
    completedAt === undefined ||
    alertedAt === undefined
  ) {
    return fallback
  }

  if (status === 'running') {
    if (endsAt === null) return fallback
    if (endsAt <= now) {
      return {
        durationMs,
        remainingMs: 0,
        overrunMs: elapsedWholeSeconds(endsAt, now),
        endsAt: null,
        status: 'done',
        completedAt: endsAt,
        alertedAt: null,
      }
    }

    return {
      durationMs,
      remainingMs: remainingWholeSeconds(endsAt, now),
      overrunMs: 0,
      endsAt,
      status,
      completedAt: null,
      alertedAt: null,
    }
  }

  if (status === 'paused') {
    if (endsAt !== null || remainingMs <= 0) return fallback
    return {
      durationMs,
      remainingMs,
      overrunMs: 0,
      endsAt: null,
      status,
      completedAt: null,
      alertedAt: null,
    }
  }

  if (status === 'done') {
    if (completedAt === null || endsAt !== null) return fallback
    return {
      durationMs,
      remainingMs: 0,
      overrunMs: elapsedWholeSeconds(completedAt, now),
      endsAt: null,
      status,
      completedAt,
      alertedAt,
    }
  }

  return fallback
}

export function loadTimerRuntimeSession(
  sessionId: string,
  fallback: TimerState,
  now = Date.now(),
): TimerState {
  if (!isRuntimeSessionId(sessionId)) return fallback
  const raw = loadSession(sessionId, 'timer')
  if (!isRecord(raw)) return fallback

  const mainElapsedMs = nonNegativeNumber(raw.mainElapsedMs)
  const startedAt = nullableNumber(raw.startedAt)
  const status = parseStatus(raw.status)
  const splits = parseSplits(raw.splits)

  if (
    mainElapsedMs === null ||
    startedAt === undefined ||
    status === null ||
    splits === null
  ) {
    return fallback
  }

  if (status === 'running') {
    if (startedAt === null) return fallback
    return {
      mainElapsedMs: Math.max(now - startedAt, 0),
      startedAt,
      status,
      splits,
    }
  }

  if (status === 'paused' && startedAt === null) {
    return { mainElapsedMs, startedAt: null, status, splits }
  }

  return fallback
}

export function loadPomodoroRuntimeSession(
  sessionId: string,
  fallback: PomodoroState,
  now = Date.now(),
): PomodoroState {
  if (!isRuntimeSessionId(sessionId)) return fallback
  const raw = loadSession(sessionId, 'pomodoro')
  if (!isRecord(raw)) return fallback

  const workDurationMs = positiveNumber(raw.workDurationMs)
  const breakMs = positiveNumber(raw.breakMs)
  const sessionsPerCycle = positiveInteger(raw.sessionsPerCycle)
  const currentPhase = parsePomodoroPhase(raw.currentPhase)
  const currentSession = positiveInteger(raw.currentSession)
  const remainingMs = nonNegativeNumber(raw.remainingMs)
  const endsAt = nullableNumber(raw.endsAt)
  const status = parseStatus(raw.status)
  const completedAt = nullableNumber(raw.completedAt)
  const alertedAt = nullableNumber(raw.alertedAt)

  if (
    workDurationMs === null ||
    breakMs === null ||
    sessionsPerCycle === null ||
    currentPhase === null ||
    currentSession === null ||
    currentSession > sessionsPerCycle ||
    remainingMs === null ||
    endsAt === undefined ||
    status === null ||
    completedAt === undefined ||
    alertedAt === undefined
  ) {
    return fallback
  }

  const base = {
    workDurationMs,
    breakMs,
    sessionsPerCycle,
    currentPhase,
    currentSession,
  }

  if (status === 'running') {
    if (endsAt === null) return fallback
    if (endsAt <= now) {
      return {
        ...base,
        remainingMs: 0,
        endsAt: null,
        status: 'done',
        completedAt: endsAt,
        alertedAt: null,
      }
    }

    return {
      ...base,
      remainingMs: remainingWholeSeconds(endsAt, now),
      endsAt,
      status,
      completedAt: null,
      alertedAt: null,
    }
  }

  if (status === 'paused') {
    if (endsAt !== null || remainingMs <= 0) return fallback
    return {
      ...base,
      remainingMs,
      endsAt: null,
      status,
      completedAt: null,
      alertedAt: null,
    }
  }

  if (status === 'done') {
    if (completedAt === null || endsAt !== null) return fallback
    return {
      ...base,
      remainingMs: 0,
      endsAt: null,
      status,
      completedAt,
      alertedAt,
    }
  }

  return fallback
}

export function saveRuntimeSession(
  sessionId: string,
  kind: ToolKind,
  state: CountdownState | TimerState | PomodoroState,
): void {
  if (!isRuntimeSessionId(sessionId)) return
  let status: unknown
  try {
    status = state.status
  } catch {
    return
  }
  if (status === 'idle') {
    clearRuntimeSession(sessionId)
    return
  }

  let normalizedState: CountdownState | TimerState | PomodoroState | null
  try {
    normalizedState = sanitizeRuntimeState(kind, state)
  } catch {
    return
  }
  if (!normalizedState) return

  const store = readStore()
  store.sessions[sessionId] = { kind, state: normalizedState }
  writeStore(store)
}

export function clearRuntimeSession(sessionId: string): void {
  if (!isRuntimeSessionId(sessionId)) return
  const store = readStore()
  if (!(sessionId in store.sessions)) return
  delete store.sessions[sessionId]
  writeStore(store)
}

export function clearDashboardRuntimeSessions(tileIds: string[]): void {
  const store = readStore()
  let changed = false
  for (const tileId of tileIds) {
    const sessionId = dashboardRuntimeSessionId(tileId)
    if (sessionId in store.sessions) {
      delete store.sessions[sessionId]
      changed = true
    }
  }
  if (changed) writeStore(store)
}

function loadSession(sessionId: string, expectedKind: ToolKind): unknown {
  const session = readStore().sessions[sessionId]
  return session?.kind === expectedKind ? session.state : null
}

function emptyStore(): RuntimeSessionsStore {
  return { version: RUNTIME_SESSIONS_VERSION, sessions: {} }
}

function readStore(): RuntimeSessionsStore {
  if (memoryStore) return memoryStore
  if (typeof window === 'undefined') return emptyStore()

  try {
    const stored = window.localStorage.getItem(RUNTIME_SESSIONS_STORAGE_KEY)
    if (!stored) return emptyStore()
    const parsed: unknown = JSON.parse(stored)
    if (!isRecord(parsed) || !isRecord(parsed.sessions)) {
      return emptyStore()
    }
    if (
      Object.prototype.hasOwnProperty.call(parsed, 'version') &&
      parsed.version !== RUNTIME_SESSIONS_VERSION
    ) return emptyStore()

    const sessions: Record<string, StoredRuntimeSession> = {}
    for (const [id, candidate] of Object.entries(parsed.sessions)) {
      if (Object.keys(sessions).length >= MAX_STORED_SESSIONS) break
      if (
        !isRuntimeSessionId(id) ||
        !isRecord(candidate) ||
        !isToolKind(candidate.kind) ||
        !('state' in candidate)
      ) continue
      sessions[id] = { kind: candidate.kind, state: candidate.state }
    }
    return { version: RUNTIME_SESSIONS_VERSION, sessions }
  } catch {
    return emptyStore()
  }
}

function writeStore(store: RuntimeSessionsStore): void {
  if (typeof window === 'undefined') return
  if (Object.keys(store.sessions).length === 0) {
    removeStore()
    return
  }

  let serialized: string
  try {
    const result = JSON.stringify(store)
    if (typeof result !== 'string') throw new TypeError('Runtime store is not serializable')
    serialized = result
  } catch {
    memoryStore = store
    return
  }

  if (lastFailedSerialization === serialized) {
    memoryStore = store
    return
  }

  try {
    window.localStorage.setItem(RUNTIME_SESSIONS_STORAGE_KEY, serialized)
    memoryStore = null
    lastFailedSerialization = null
    removeFailed = false
  } catch {
    memoryStore = store
    lastFailedSerialization = serialized
  }
}

function removeStore(): void {
  memoryStore = emptyStore()
  lastFailedSerialization = null
  if (typeof window === 'undefined' || removeFailed) return
  try {
    window.localStorage.removeItem(RUNTIME_SESSIONS_STORAGE_KEY)
    memoryStore = null
    removeFailed = false
  } catch {
    removeFailed = true
  }
}

function isToolKind(value: unknown): value is ToolKind {
  return value === 'countdown' || value === 'timer' || value === 'pomodoro'
}

function parseStatus(value: unknown): ToolStatus | null {
  return value === 'idle' || value === 'running' || value === 'paused' || value === 'done'
    ? value
    : null
}

function parsePomodoroPhase(value: unknown): PomodoroPhase | null {
  return value === 'work' || value === 'break' ? value : null
}

function nonNegativeNumber(value: unknown): number | null {
  return Number.isSafeInteger(value) && (value as number) >= 0 ? value as number : null
}

function positiveNumber(value: unknown): number | null {
  return Number.isSafeInteger(value) && (value as number) > 0 && (value as number) <= MAX_TIMER_INPUT_MS
    ? value as number
    : null
}

function positiveInteger(value: unknown): number | null {
  return Number.isSafeInteger(value) && (value as number) > 0 && (value as number) <= MAX_POMODORO_SESSIONS
    ? value as number
    : null
}

function nullableNumber(value: unknown): number | null | undefined {
  if (value === null) return null
  return Number.isSafeInteger(value) && (value as number) >= 0 ? value as number : undefined
}

function parseSplits(value: unknown): Split[] | null {
  if (!Array.isArray(value) || value.length > MAX_SPLITS) return null
  const splits: Split[] = []
  let previousCumulative = 0
  for (const candidate of value) {
    if (!isRecord(candidate)) return null
    const cumulativeMs = nonNegativeNumber(candidate.cumulativeMs)
    const splitMs = nonNegativeNumber(candidate.splitMs)
    if (
      cumulativeMs === null ||
      splitMs === null ||
      cumulativeMs < previousCumulative ||
      splitMs !== cumulativeMs - previousCumulative
    ) {
      return null
    }
    splits.push({ cumulativeMs, splitMs })
    previousCumulative = cumulativeMs
  }
  return splits
}

function isRuntimeSessionId(value: unknown): value is string {
  return parseStorageId(value) !== null
}

function sanitizeRuntimeState(
  kind: ToolKind,
  value: CountdownState | TimerState | PomodoroState,
): CountdownState | TimerState | PomodoroState | null {
  if (!isRecord(value)) return null

  if (kind === 'countdown') {
    const durationMs = positiveNumber(value.durationMs)
    const remainingMs = nonNegativeNumber(value.remainingMs)
    const overrunMs = nonNegativeNumber(value.overrunMs)
    const status = parseStatus(value.status)
    const endsAt = nullableNumber(value.endsAt)
    const completedAt = nullableNumber(value.completedAt)
    const alertedAt = nullableNumber(value.alertedAt)
    if (
      durationMs === null || remainingMs === null || remainingMs > durationMs ||
      overrunMs === null || status === null || status === 'idle' ||
      endsAt === undefined || completedAt === undefined || alertedAt === undefined
    ) return null
    if (status === 'running' && endsAt === null) return null
    if (status === 'paused' && (endsAt !== null || remainingMs <= 0)) return null
    if (status === 'done' && (endsAt !== null || completedAt === null || remainingMs !== 0)) return null
    return { durationMs, remainingMs, overrunMs, status, endsAt, completedAt, alertedAt }
  }

  if (kind === 'timer') {
    const mainElapsedMs = nonNegativeNumber(value.mainElapsedMs)
    const startedAt = nullableNumber(value.startedAt)
    const status = parseStatus(value.status)
    const splits = parseSplits(value.splits)
    if (
      mainElapsedMs === null || startedAt === undefined || splits === null ||
      (status !== 'running' && status !== 'paused')
    ) return null
    if (status === 'running' && startedAt === null) return null
    if (status === 'paused' && startedAt !== null) return null
    return { mainElapsedMs, startedAt, status, splits }
  }

  const workDurationMs = positiveNumber(value.workDurationMs)
  const breakMs = positiveNumber(value.breakMs)
  const sessionsPerCycle = positiveInteger(value.sessionsPerCycle)
  const currentSession = positiveInteger(value.currentSession)
  const currentPhase = parsePomodoroPhase(value.currentPhase)
  const remainingMs = nonNegativeNumber(value.remainingMs)
  const endsAt = nullableNumber(value.endsAt)
  const status = parseStatus(value.status)
  const completedAt = nullableNumber(value.completedAt)
  const alertedAt = nullableNumber(value.alertedAt)
  if (
    workDurationMs === null || breakMs === null || sessionsPerCycle === null ||
    currentSession === null || currentSession > sessionsPerCycle || currentPhase === null ||
    remainingMs === null || remainingMs > (currentPhase === 'work' ? workDurationMs : breakMs) ||
    endsAt === undefined || status === null || status === 'idle' ||
    completedAt === undefined || alertedAt === undefined
  ) return null
  if (status === 'running' && endsAt === null) return null
  if (status === 'paused' && (endsAt !== null || remainingMs <= 0)) return null
  if (status === 'done' && (endsAt !== null || completedAt === null || remainingMs !== 0)) return null
  return {
    workDurationMs,
    breakMs,
    sessionsPerCycle,
    currentPhase,
    currentSession,
    remainingMs,
    endsAt,
    status,
    completedAt,
    alertedAt,
  }
}

function remainingWholeSeconds(endsAt: number, now: number): number {
  return Math.ceil(Math.max(endsAt - now, 0) / 1000) * 1000
}

function elapsedWholeSeconds(completedAt: number, now: number): number {
  return Math.max(Math.floor((now - completedAt) / 1000), 0) * 1000
}
