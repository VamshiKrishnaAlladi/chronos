import { type RefObject } from 'react'

interface TimeSegmentInputProps {
  inputRef?: RefObject<HTMLInputElement | null>
  label: string
  value: string
  disabled: boolean
  onFocus: () => void
  onChange: (value: string) => void
  onBlur: () => void
  onMovePrevious?: () => void
  onMoveNext?: () => void
}

export function TimeSegmentInput({
  inputRef,
  label,
  value,
  disabled,
  onFocus,
  onChange,
  onBlur,
  onMovePrevious,
  onMoveNext,
}: TimeSegmentInputProps) {
  return (
    <input
      ref={inputRef}
      className="time-segment"
      type="text"
      inputMode="numeric"
      aria-label={label}
      value={value}
      disabled={disabled}
      maxLength={2}
      onFocus={(event) => {
        onFocus()
        event.currentTarget.select()
      }}
      onChange={(event) => {
        onChange(event.target.value.replace(/\D/g, '').slice(0, 2))
      }}
      onBlur={onBlur}
      onKeyDown={(event) => {
        const currentTarget = event.currentTarget

        if (event.key === 'ArrowLeft' && currentTarget.selectionStart === 0) {
          onMovePrevious?.()
        }

        if (
          (event.key === 'ArrowRight' && currentTarget.selectionStart === currentTarget.value.length) ||
          event.key === ':'
        ) {
          event.preventDefault()
          onMoveNext?.()
        }

        if (event.key === 'Backspace' && currentTarget.value.length === 0) {
          onMovePrevious?.()
        }
      }}
    />
  )
}
