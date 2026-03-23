import { type RefObject } from 'react'
import { TimeSegmentInput } from './TimeSegmentInput'
import { type TimePartKey, type TimeParts, TIME_PART_ORDER } from '../types'

interface TimePartsInputProps {
  refs: Record<TimePartKey, RefObject<HTMLInputElement | null>>
  label: string
  parts: TimeParts
  disabled: boolean
  invalid: boolean
  onPartChange: (part: TimePartKey, value: string) => void
  onPartBlur: (part: TimePartKey) => void
  onFocus?: () => void
}

export function TimePartsInput({
  refs,
  label,
  parts,
  disabled,
  invalid,
  onPartChange,
  onPartBlur,
  onFocus,
}: TimePartsInputProps) {
  function focusPartRef(part: TimePartKey) {
    refs[part].current?.focus()
    refs[part].current?.select()
  }

  return (
    <label className="inline-input">
      <span>{label}</span>
      <div className="time-input-group" aria-invalid={invalid}>
        {TIME_PART_ORDER.map((part, index) => (
          <span key={part} className="time-segment-wrap">
            <TimeSegmentInput
              inputRef={refs[part]}
              label={`${label} ${part}`}
              value={parts[part]}
              disabled={disabled}
              onFocus={onFocus ?? (() => {})}
              onChange={(value) => {
                onPartChange(part, value)
                if (value.length === 2 && index < TIME_PART_ORDER.length - 1) {
                  focusPartRef(TIME_PART_ORDER[index + 1])
                }
              }}
              onBlur={() => onPartBlur(part)}
              onMovePrevious={
                index > 0 ? () => focusPartRef(TIME_PART_ORDER[index - 1]) : undefined
              }
              onMoveNext={
                index < TIME_PART_ORDER.length - 1
                  ? () => focusPartRef(TIME_PART_ORDER[index + 1])
                  : undefined
              }
            />
            {index < TIME_PART_ORDER.length - 1 ? (
              <span className="time-colon" aria-hidden="true">
                :
              </span>
            ) : null}
          </span>
        ))}
      </div>
    </label>
  )
}
