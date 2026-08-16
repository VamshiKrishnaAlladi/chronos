import { useCallback, useEffect, useRef, useState } from 'react'

export type WakeLockStatus =
  | 'unsupported'
  | 'disabled'
  | 'idle'
  | 'requesting'
  | 'active'
  | 'error'

interface UseWakeLockOptions {
  enabled: boolean
  active: boolean
}

function supportsWakeLock(): boolean {
  return typeof navigator !== 'undefined' && 'wakeLock' in navigator
}

export function useWakeLock({ enabled, active }: UseWakeLockOptions) {
  const supported = supportsWakeLock()
  const [lockStatus, setLockStatus] = useState<WakeLockStatus>('idle')
  const sentinelRef = useRef<WakeLockSentinel | null>(null)
  const requestInFlightRef = useRef(false)
  const mountedRef = useRef(true)
  const conditionsRef = useRef({ enabled, active })

  useEffect(() => {
    conditionsRef.current = { enabled, active }
  }, [active, enabled])

  const shouldHoldLock = useCallback(() => (
    supported &&
    mountedRef.current &&
    conditionsRef.current.enabled &&
    conditionsRef.current.active &&
    document.visibilityState === 'visible'
  ), [supported])

  const release = useCallback(() => {
    const sentinel = sentinelRef.current
    sentinelRef.current = null
    if (sentinel && !sentinel.released) {
      void sentinel.release().catch(() => {})
    }
  }, [])

  const acquire = useCallback(() => {
    if (!shouldHoldLock() || sentinelRef.current || requestInFlightRef.current) {
      return
    }

    const wakeLock = navigator.wakeLock
    if (!wakeLock) {
      setLockStatus('unsupported')
      return
    }

    requestInFlightRef.current = true
    void Promise.resolve().then(() => {
      if (!shouldHoldLock()) {
        requestInFlightRef.current = false
        return undefined
      }

      setLockStatus('requesting')
      return wakeLock.request('screen')
    }).then((sentinel) => {
      if (!sentinel) return
      requestInFlightRef.current = false

      if (!shouldHoldLock()) {
        void sentinel.release().catch(() => {})
        return
      }

      sentinelRef.current = sentinel
      setLockStatus('active')
      sentinel.addEventListener('release', () => {
        if (sentinelRef.current !== sentinel) return
        sentinelRef.current = null
        setLockStatus('idle')
      }, { once: true })
    }).catch(() => {
      requestInFlightRef.current = false
      if (shouldHoldLock()) setLockStatus('error')
    })
  }, [shouldHoldLock])

  useEffect(() => {
    if (!supported) {
      return
    }

    if (shouldHoldLock()) {
      queueMicrotask(acquire)
    } else {
      release()
    }
  }, [active, acquire, enabled, release, shouldHoldLock, supported])

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        acquire()
      } else {
        release()
        if (supported) setLockStatus('idle')
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [acquire, enabled, release, supported])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      release()
    }
  }, [release])

  const status: WakeLockStatus = !supported
    ? 'unsupported'
    : !enabled
      ? 'disabled'
      : !active || document.visibilityState !== 'visible'
        ? 'idle'
        : lockStatus

  return { supported, status }
}
