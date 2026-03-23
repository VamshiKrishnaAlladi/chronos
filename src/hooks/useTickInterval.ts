import { useEffect } from 'react'

/**
 * Runs a setInterval while `active` is true, calling `onTick` every 250ms.
 * Cleans up the interval when `active` flips to false or deps change.
 */
export function useTickInterval(
  active: boolean,
  onTick: (now: number) => void,
  deps: unknown[],
): void {
  useEffect(() => {
    if (!active) return

    const id = window.setInterval(() => {
      onTick(Date.now())
    }, 250)

    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, ...deps])
}
