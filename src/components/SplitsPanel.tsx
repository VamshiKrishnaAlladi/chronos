import type { RefObject } from 'react'
import type { Split } from '../types'
import { formatSplitTime } from '../lib/time'

interface SplitsPanelProps {
  splits: Split[]
  bodyRef?: RefObject<HTMLDivElement | null>
  className: string
}

export function SplitsPanel({ splits, bodyRef, className }: SplitsPanelProps) {
  return (
    <div className={`splits-list ${className}`}>
      {splits.length > 0 && (
        <>
          <div className="splits-header">
            <span>#</span>
            <span>Split</span>
            <span>Cumulative</span>
          </div>
          <div className="splits-body" ref={bodyRef}>
            {splits.map((s, i) => (
              <div className="splits-row" key={i}>
                <span>{i + 1}</span>
                <span>{formatSplitTime(s.splitMs)}</span>
                <span>{formatSplitTime(s.cumulativeMs)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
