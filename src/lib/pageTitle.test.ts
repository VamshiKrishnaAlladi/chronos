import { describe, expect, it } from 'vitest'
import { DEFAULT_PAGE_TITLE, formatPageTitle } from './pageTitle'

describe('page title formatting', () => {
  it('uses the default title when no timers are active', () => {
    expect(formatPageTitle([])).toBe(DEFAULT_PAGE_TITLE)
  })

  it('sorts timers and prefixes overrun values', () => {
    expect(formatPageTitle([
      { ms: 5000, overrun: false },
      { ms: 2000, overrun: true },
    ])).toBe('+00:00:02 | 00:00:05')
  })
})
