import { useState, useRef, useEffect } from 'react'

const STEPS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

interface VolumeControlProps {
  volume: number
  onChange: (volume: number) => void
}

export function VolumeControl({ volume, onChange }: VolumeControlProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  function handleStepClick(step: number) {
    onChange(step)
    setOpen(false)
  }

  return (
    <div className="volume-control" ref={ref}>
      <button
        type="button"
        className={`sound-corner-toggle${volume > 0 ? ' sound-corner-toggle-active' : ''}`}
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
      >
        <span className="sound-corner-toggle-label">Sound</span>
        <span className="sound-corner-toggle-state">{volume === 0 ? 'Off' : 'On'}</span>
        <span className={`sound-corner-toggle-level${volume === 0 ? ' sound-corner-toggle-level-hidden' : ''}`}>
          [{volume === 0 ? '100' : volume}%]
        </span>
      </button>

      {open && (
        <div className="volume-popup">
          <div className="volume-track">
            {STEPS.map(step => (
              <button
                key={step}
                type="button"
                className={`volume-step${step <= volume ? ' volume-step-filled' : ''}${step === volume ? ' volume-step-active' : ''}`}
                onClick={() => handleStepClick(step)}
                aria-label={`${step}%`}
              />
            ))}
          </div>
          <div className="volume-labels">
            <span>0</span>
            <span>100</span>
          </div>
        </div>
      )}
    </div>
  )
}
