/// <reference types="node" />

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const indexStyles = readFileSync('src/index.css', 'utf8')

function channelToLinear(channel: number) {
  const value = channel / 255
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

function luminance(hex: string) {
  const channels = hex.match(/[a-f\d]{2}/gi)?.map(value => Number.parseInt(value, 16)) ?? []
  const [red, green, blue] = channels.map(channelToLinear)
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

function contrastRatio(foreground: string, background: string) {
  const lighter = Math.max(luminance(foreground), luminance(background))
  const darker = Math.min(luminance(foreground), luminance(background))
  return (lighter + 0.05) / (darker + 0.05)
}

describe('accessibility style safeguards', () => {
  it('keeps muted text above WCAG AA contrast on the app background', () => {
    const background = indexStyles.match(/--bg:\s*(#[a-f\d]{6})/i)?.[1]
    const muted = indexStyles.match(/--text-muted:\s*(#[a-f\d]{6})/i)?.[1]

    expect(background).toBeTruthy()
    expect(muted).toBeTruthy()
    expect(contrastRatio(muted!, background!)).toBeGreaterThanOrEqual(4.5)
  })

  it('provides a reusable visually-hidden treatment for semantic timer text', () => {
    expect(indexStyles).toContain('.sr-only')
    expect(indexStyles).toContain('clip: rect(0, 0, 0, 0);')
    expect(indexStyles).toContain('white-space: nowrap;')
  })
})
