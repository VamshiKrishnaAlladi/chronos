const LEGACY_CACHE_PREFIXES = ['chronos-cache-', 'chronos-navigation-', 'workbox-precache-']

/**
 * Vite development deliberately has no service worker. Remove registrations
 * and app-shell caches left by a production preview on the same origin so they
 * cannot mask local source changes.
 */
export async function clearDevelopmentServiceWorkers(): Promise<void> {
  if (!import.meta.env.DEV || typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return
  }

  const registrations = await navigator.serviceWorker.getRegistrations()
  const wasControlled = navigator.serviceWorker.controller !== null

  await Promise.all(registrations.map((registration) => registration.unregister()))

  if ('caches' in window) {
    const cacheNames = await caches.keys()
    await Promise.all(
      cacheNames
        .filter((name) => LEGACY_CACHE_PREFIXES.some((prefix) => name.startsWith(prefix)))
        .map((name) => caches.delete(name)),
    )
  }

  if (wasControlled && registrations.length > 0) {
    window.location.reload()
  }
}
