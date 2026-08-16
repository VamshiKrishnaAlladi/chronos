/// <reference types="node" />

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const appStyles = readFileSync('src/App.css', 'utf8')
const dashboardStyles = readFileSync('src/styles/dashboard.css', 'utf8')
const responsiveStyles = readFileSync('src/styles/responsive.css', 'utf8')

function stylesForMediaQuery(query: string, nextQuery?: string) {
  const start = responsiveStyles.indexOf(query)
  const end = nextQuery
    ? responsiveStyles.indexOf(nextQuery, start + query.length)
    : responsiveStyles.length

  expect(start).toBeGreaterThanOrEqual(0)
  expect(end).toBeGreaterThan(start)

  return responsiveStyles.slice(start, end)
}

describe('responsive layout safeguards', () => {
  const compactStyles = stylesForMediaQuery('@media (max-width: 1100px)', '@media (max-height: 640px)')
  const intermediateStyles = stylesForMediaQuery('@media (max-width: 740px)', '@media (max-width: 640px)')
  const mobileStyles = stylesForMediaQuery('@media (max-width: 640px)', '@media (max-width: 360px)')
  const narrowStyles = stylesForMediaQuery('@media (max-width: 360px)', '@media (prefers-reduced-motion: reduce)')

  it('constrains focus and dashboard readouts to the mobile viewport', () => {
    expect(compactStyles).toContain('font-size: clamp(3.5rem, 10.5vw, 7rem);')
    expect(compactStyles).toContain('padding-top: clamp(5.5rem, 10vw, 6.5rem);')
    expect(mobileStyles).toContain('width: 100%;\n    min-width: 0;')
    expect(mobileStyles).toContain('font-size: clamp(2.75rem, 15vw, 5rem);')
    expect(narrowStyles).toContain('font-size: clamp(2.5rem, 14vw, 3.15rem);')
  })

  it('separates dashboard branding from mobile controls', () => {
    expect(intermediateStyles).toContain('.app-chrome-dashboard')
    expect(intermediateStyles).toContain('grid-template-columns: 1fr;')
    expect(intermediateStyles).toContain('grid-row: 2;')
    expect(mobileStyles).toContain('.app-shell-dashboard .brand-corner')
    expect(mobileStyles).toContain('display: none;')
    expect(narrowStyles).toContain('flex-direction: column;')
  })

  it('keeps primary mobile controls at least 44px tall', () => {
    expect(mobileStyles).toContain('.view-toggle-btn,')
    expect(mobileStyles).toContain('.tool-menu-item,')
    expect(mobileStyles).toContain('.tile-menu-trigger,')
    expect(mobileStyles).toContain('min-height: 44px;')
  })

  it('scales every tile readout from its own card width and keeps split tables inset', () => {
    expect(dashboardStyles).toContain('container-type: inline-size;')
    expect(dashboardStyles).toContain('--tile-readout-size: clamp(2rem, 13cqi, 10rem);')
    expect(dashboardStyles).toContain('--tile-readout-size: clamp(1.875rem, 11cqi, 8rem);')
    expect(dashboardStyles).toContain('--tile-readout-size: clamp(1.35rem, 7cqi, 4rem);')
    expect(dashboardStyles).toContain('width: 3ch;\n  flex: 0 0 3ch;')
    expect(dashboardStyles).toContain('max-width: 100%;\n  box-sizing: border-box;')
    expect(dashboardStyles).toContain('padding-inline: clamp(0.3rem, 1vw, 0.6rem);')
  })
})

describe('stylesheet module order', () => {
  it('loads cohesive app styles in their original cascade order', () => {
    expect(appStyles).toBe(
      "@import './styles/focus.css';\n" +
        "@import './styles/dashboard.css';\n" +
        "@import './styles/responsive.css';\n",
    )
  })
})
