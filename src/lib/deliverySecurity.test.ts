/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('production delivery security', () => {
  it('bundles only the selected local font families and weights', () => {
    const entry = readFileSync('src/main.tsx', 'utf8')
    const fontStyles = readFileSync('src/styles/fonts.css', 'utf8')
    const globalStyles = readFileSync('src/index.css', 'utf8')
    const config = readFileSync('vite.config.ts', 'utf8')

    expect(entry).toContain("import './styles/fonts.css'")
    expect(fontStyles.match(/@font-face/g)).toHaveLength(5)
    expect(fontStyles.match(/font-family: 'Inter'/g)).toHaveLength(3)
    expect(fontStyles.match(/font-family: 'Orbitron'/g)).toHaveLength(2)
    expect(fontStyles.match(/font-weight: (?:400|500|600|700)/g)).toHaveLength(5)
    expect(fontStyles.match(/\.woff2/g)).toHaveLength(5)
    expect(fontStyles).not.toMatch(/\.woff['")]/)
    expect(globalStyles).not.toMatch(/fonts\.(?:googleapis|gstatic)\.com/i)
    expect(config).toContain('css,woff2,svg')
  })

  it('locks down production routes while preserving app capabilities', () => {
    const config = JSON.parse(readFileSync('vercel.json', 'utf8'))
    const route = config.headers.find((entry: { source: string }) => entry.source === '/(.*)')
    const headers = Object.fromEntries(
      route.headers.map(({ key, value }: { key: string; value: string }) => [key, value]),
    )
    const csp = headers['Content-Security-Policy']

    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("script-src 'self'")
    expect(csp).not.toMatch(/script-src[^;]*(?:'unsafe-inline'|'unsafe-eval')/)
    expect(csp).toContain("font-src 'self'")
    expect(csp).toContain("media-src 'self'")
    expect(csp).toContain("worker-src 'self'")
    expect(csp).toContain("connect-src 'self'")
    expect(csp).toContain("manifest-src 'self'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(headers['X-Content-Type-Options']).toBe('nosniff')
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin')
    expect(headers['X-Frame-Options']).toBe('DENY')
    expect(headers['Permissions-Policy']).toContain('screen-wake-lock=(self)')
    expect(headers['Permissions-Policy']).not.toContain('notifications=()')
    expect(headers['Strict-Transport-Security']).toBeUndefined()
  })
})
