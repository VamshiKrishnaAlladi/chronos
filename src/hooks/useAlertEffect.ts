import { useEffect } from 'react'
import { startRepeatingCompletionTone } from '../lib/notifications'

/**
 * Triggers the completion tone when `shouldAlert` becomes true,
 * then calls `onAlerted` to mark the alert as fired.
 */
export function useAlertEffect(
  shouldAlert: boolean,
  onAlerted: () => void,
  deps: unknown[],
): void {
  useEffect(() => {
    if (!shouldAlert) return

    let cancelled = false

    void (async () => {
      await startRepeatingCompletionTone()
      if (!cancelled) {
        onAlerted()
      }
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldAlert, ...deps])
}
