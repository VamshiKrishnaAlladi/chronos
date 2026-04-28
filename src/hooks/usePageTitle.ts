import { useEffect } from 'react'
import type { PageTitleTimer } from '../types'
import { formatPageTitle } from '../lib/pageTitle'

interface UsePageTitleOptions {
  getValues: () => PageTitleTimer[]
  refresh: boolean
}

export function usePageTitle({ getValues, refresh }: UsePageTitleOptions): void {
  useEffect(() => {
    function updateTitle() {
      document.title = formatPageTitle(getValues())
    }

    updateTitle()

    if (!refresh) {
      return
    }

    const id = setInterval(updateTitle, 500)
    return () => clearInterval(id)
  }, [getValues, refresh])
}
