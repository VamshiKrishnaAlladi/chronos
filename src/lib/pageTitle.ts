import type { PageTitleTimer } from '../types'
import { formatDuration } from './time'

export const DEFAULT_PAGE_TITLE = 'VKA | Chronos'

export function formatPageTitle(values: PageTitleTimer[]): string {
  if (values.length === 0) {
    return DEFAULT_PAGE_TITLE
  }

  return [...values]
    .sort((a, b) => a.ms - b.ms)
    .map(({ ms, overrun }) => `${overrun ? '+' : ''}${formatDuration(ms)}`)
    .join(' | ')
}
