import { useState, useRef, useEffect, useId } from 'react'
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
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownId = useId()

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', handleClickOutside)
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
        triggerRef.current?.focus()
      }
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
        ref={triggerRef}
        type="button"
        className="tile-menu-trigger"
        onClick={() => setOpen(v => !v)}
        aria-label="Tile options"
        aria-expanded={open}
        aria-controls={dropdownId}
      >
        ⋮
      </button>
      {open && (
        <div id={dropdownId} className="tile-menu-dropdown">
          {otherKinds.map(kind => (
            <button
              key={kind}
              type="button"
              className="tile-menu-option"
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
