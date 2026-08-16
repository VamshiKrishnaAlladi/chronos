import { useCallback, useEffect, useState } from 'react'
import {
  getCompletionNotificationPermission,
  requestCompletionNotificationPermission,
  type CompletionNotificationPermission,
} from '../lib/completionNotifications'

export function useNotificationPermission() {
  const [permission, setPermission] = useState<CompletionNotificationPermission>(
    getCompletionNotificationPermission,
  )
  const [requesting, setRequesting] = useState(false)
  const [requestFailed, setRequestFailed] = useState(false)

  const refresh = useCallback(() => {
    setPermission(getCompletionNotificationPermission())
  }, [])

  useEffect(() => {
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [refresh])

  const requestPermission = useCallback(async () => {
    if (getCompletionNotificationPermission() !== 'default') {
      refresh()
      return
    }

    setRequesting(true)
    setRequestFailed(false)
    try {
      setPermission(await requestCompletionNotificationPermission())
    } catch {
      setPermission(getCompletionNotificationPermission())
      setRequestFailed(true)
    } finally {
      setRequesting(false)
    }
  }, [refresh])

  return { permission, requesting, requestFailed, requestPermission }
}
