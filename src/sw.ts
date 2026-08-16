/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precache, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { NetworkFirst } from 'workbox-strategies'

declare let self: ServiceWorkerGlobalScope

const precacheEntries = self.__WB_MANIFEST
const isAppShellEntry = (entry: (typeof precacheEntries)[number]) =>
  (typeof entry === 'string' ? entry : entry.url) === 'index.html'
const appShellEntries = precacheEntries.filter(isAppShellEntry)
const assetEntries = precacheEntries.filter((entry) => !isAppShellEntry(entry))

// Keep the document out of Workbox's cache-first precache route so navigations
// can prefer the network. It is still revisioned and precached for offline use.
precache(appShellEntries)
precacheAndRoute(assetEntries)
cleanupOutdatedCaches()
clientsClaim()

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    event.waitUntil(self.skipWaiting())
  }
})

const navigationStrategy = new NetworkFirst({
  cacheName: 'chronos-navigation-v1',
  networkTimeoutSeconds: 4,
})
const offlineAppShell = createHandlerBoundToURL('index.html')

registerRoute(
  new NavigationRoute(async (options) => {
    try {
      return await navigationStrategy.handle(options)
    } catch {
      return offlineAppShell(options)
    }
  }),
)

// Remove the cache used by the retired hand-written service worker.
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.delete('chronos-cache-v1'))
})
