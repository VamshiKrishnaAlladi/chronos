import { useState, useRef, useEffect } from 'react'
import type { ToolKind, ToolStatus } from '../types'
import { TOOL_LABELS } from '../types'

interface TileMenuProps {
  currentKind: ToolKind
  status: ToolStatus
  onChangeKind: (kind: ToolKind) => void
  onRemove: () => void
}

const ALL_KINDS: ToolKind[] = ['countdown', 'timer', 'pomodoro']

export function TileMenu({ currentKind, status, onChangeKind, onRemove }: TileMenuProps) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', handleClickOutside)
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  const isIdle = status === 'idle' || status === 'done'
  const otherKinds = ALL_KINDS.filter(k => k !== currentKind)

  return (
    <div className="tile-menu" ref={menuRef}>
      <button
        type="button"
        className="tile-menu-trigger"
        onClick={() => setOpen(v => !v)}
        aria-label="Tile options"
        aria-expanded={open}
      >
        ⋮
      </button>
      {open && (
        <div className="tile-menu-dropdown" role="menu">
          {otherKinds.map(kind => (
            <button
              key={kind}
              type="button"
              className="tile-menu-option"
              role="menuitem"
              disabled={!isIdle}
              onClick={() => {
                onChangeKind(kind)
                setOpen(false)
              }}
            >
              Switch to {TOOL_LABELS[kind]}
            </button>
          ))}
          <button
            type="button"
            className="tile-menu-option tile-menu-option-danger"
            role="menuitem"
            onClick={() => {
              onRemove()
              setOpen(false)
            }}
          >
            Remove
          </button>
        </div>
      )}
    </div>
  )
}
