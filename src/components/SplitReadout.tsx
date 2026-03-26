interface SplitReadoutProps {
  ms: number
}

export function SplitReadout({ ms }: SplitReadoutProps) {
  const total = Math.max(ms, 0)
  const minutes = String(Math.floor(total / 60_000)).padStart(2, '0')
  const seconds = String(Math.floor((total % 60_000) / 1000)).padStart(2, '0')
  const millis = String(total % 1000).padStart(3, '0')

  return (
    <div className="tile-readout-input">
      <label className="inline-input">
        <span>MM:SS.mmm</span>
        <div className="time-input-group">
          <span className="time-segment-wrap">
            <input className="time-segment" type="text" disabled value={minutes} readOnly aria-label="Minutes" />
            <span className="time-colon" aria-hidden="true">:</span>
          </span>
          <span className="time-segment-wrap">
            <input className="time-segment" type="text" disabled value={seconds} readOnly aria-label="Seconds" />
            <span className="time-colon" aria-hidden="true">.</span>
          </span>
          <span className="time-segment-wrap">
            <span className="time-segment time-segment-ms" aria-label="Milliseconds">{millis}</span>
          </span>
        </div>
      </label>
    </div>
  )
}
