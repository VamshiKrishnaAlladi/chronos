import { type ReactNode } from 'react'

export interface IconButtonProps {
  children: ReactNode
  label: string
  onClick: () => void
  active?: boolean
  disabled?: boolean
}

export function IconButton({ children, label, onClick, active, disabled }: IconButtonProps) {
  return (
    <button
      type="button"
      className={`icon-button${active ? ' icon-button-active' : ''}`}
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={disabled}
    >
      {children}
    </button>
  )
}
