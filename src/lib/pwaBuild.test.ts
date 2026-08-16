/// <reference types="node" />

import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('PWA build wiring', () => {
  it('uses a generated Workbox worker and retires the public worker', () => {
    const config = readFileSync('vite.config.ts', 'utf8')

    expect(config).toContain("strategies: 'injectManifest'")
    expect(config).toContain("registerType: 'prompt'")
    expect(config).toContain('enabled: false')
    expect(existsSync('public/sw.js')).toBe(false)
  })

  it('allows the explicit update action to activate the waiting worker', () => {
    const worker = readFileSync('src/sw.ts', 'utf8')

    expect(worker).toContain("event.data?.type === 'SKIP_WAITING'")
    expect(worker).toContain('event.waitUntil(self.skipWaiting())')
  })

  it('publishes complete install metadata with dedicated maskable artwork', () => {
    const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8'))

    expect(manifest).toMatchObject({
      id: '/',
      start_url: '/',
      scope: '/',
      background_color: '#07090d',
      theme_color: '#07090d',
    })
    expect(manifest.icons).toEqual([
      expect.objectContaining({ src: '/icon-192.png', sizes: '192x192', purpose: 'any' }),
      expect.objectContaining({ src: '/icon-512.png', sizes: '512x512', purpose: 'any' }),
      expect.objectContaining({ src: '/icon-maskable-512.png', sizes: '512x512', purpose: 'maskable' }),
    ])
  })

  it('ships correctly sized install and sharing raster assets', () => {
    const dimensions = (path: string) => {
      const png = readFileSync(path)
      expect(png.subarray(1, 4).toString()).toBe('PNG')
      return [png.readUInt32BE(16), png.readUInt32BE(20)]
    }

    expect(dimensions('public/icon-192.png')).toEqual([192, 192])
    expect(dimensions('public/icon-512.png')).toEqual([512, 512])
    expect(dimensions('public/icon-maskable-512.png')).toEqual([512, 512])
    expect(dimensions('public/apple-touch-icon.png')).toEqual([180, 180])
    expect(dimensions('public/social-preview.png')).toEqual([1200, 630])
  })

  it('connects canonical, install, and share metadata to precached assets', () => {
    const html = readFileSync('index.html', 'utf8')
    const config = readFileSync('vite.config.ts', 'utf8')

    expect(html).toContain('rel="canonical" href="https://chronos.vka.me/"')
    expect(html).toContain('rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png"')
    expect(html).toContain('property="og:image" content="https://chronos.vka.me/social-preview.png"')
    expect(html).toContain('name="twitter:card" content="summary_large_image"')
    expect(config).toContain('svg,png,ico,webmanifest,mp3')
  })
})
