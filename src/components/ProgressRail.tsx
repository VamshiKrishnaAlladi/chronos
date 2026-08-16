interface ProgressRailProps {
  progress: number
  className: string
  label?: string
  decorative?: boolean
}

export function ProgressRail({
  progress,
  className,
  label = 'Timer progress',
  decorative = false,
}: ProgressRailProps) {
  return (
    <div
      className={className}
      {...(decorative ? {
        'aria-hidden': true,
      } : {
        role: 'progressbar',
        'aria-label': label,
        'aria-valuemin': 0,
        'aria-valuemax': 100,
        'aria-valuenow': progress,
      })}
    >
      <span style={{ width: `${progress}%` }} />
    </div>
  )
}
