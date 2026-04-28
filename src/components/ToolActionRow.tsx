import type { ToolFace } from '../types'

interface ToolActionRowProps {
  tool: ToolFace
  isIdle: boolean
  isRunning: boolean
  startLabel: string
  className: string
}

export function ToolActionRow({
  tool,
  isIdle,
  isRunning,
  startLabel,
  className,
}: ToolActionRowProps) {
  return (
    <div className={className}>
      {isIdle ? (
        <button
          type="button"
          className="tile-start-button"
          onClick={tool.start}
          disabled={tool.inputInvalid}
        >
          {startLabel}
        </button>
      ) : (
        <>
          {tool.split && isRunning ? (
            <button
              type="button"
              className="tile-pill-button tile-pill-button-accent"
              onClick={tool.split}
            >
              Split
            </button>
          ) : (
            <button
              type="button"
              className="tile-pill-button tile-pill-button-accent"
              onClick={tool.start}
              disabled={tool.inputInvalid}
            >
              {tool.restartLabel}
            </button>
          )}
          <button
            type="button"
            className="tile-pill-button"
            onClick={tool.stop}
          >
            Stop
          </button>
        </>
      )}
    </div>
  )
}
