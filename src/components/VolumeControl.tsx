import { useState, useRef, useEffect, useId } from 'react'

interface VolumeControlProps {
  volume: number
  onChange: (volume: number) => void
}

export function VolumeControl({ volume, onChange }: VolumeControlProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popupId = useId()

  useEffect(() => {
    if (!open) return

    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
        triggerRef.current?.focus()
      }
    }

    document.addEventListener('pointerdown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  return (
    <div className="volume-control" ref={ref}>
      <button
        ref={triggerRef}
        type="button"
        className={`sound-corner-toggle${volume > 0 ? ' sound-corner-toggle-active' : ''}`}
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-controls={popupId}
      >
        <span className="sound-corner-toggle-label">Sound</span>
        <span className="sound-corner-toggle-value">
          <span className="sound-corner-toggle-state">{volume === 0 ? 'Off' : 'On'}</span>
          <span className={`sound-corner-toggle-level${volume === 0 ? ' sound-corner-toggle-level-hidden' : ''}`}>
            {volume === 0 ? '100' : volume}/100
          </span>
        </span>
      </button>

      {open && (
        <div id={popupId} className="volume-popup">
          <div className="volume-slider-row">
            <span className="volume-side-label">0</span>
            <input
              className="volume-slider"
              type="range"
              min="0"
              max="100"
              step="10"
              value={volume}
              onChange={(event) => onChange(Number(event.currentTarget.value))}
              aria-label="Sound volume"
            />
            <span className="volume-side-label">100</span>
          </div>
        </div>
      )}
    </div>
  )
}
