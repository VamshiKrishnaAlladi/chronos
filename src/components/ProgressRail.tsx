interface ProgressRailProps {
  progress: number
  className: string
}

export function ProgressRail({ progress, className }: ProgressRailProps) {
  return (
    <div className={className}>
      <span style={{ width: `${progress}%` }} />
    </div>
  )
}
