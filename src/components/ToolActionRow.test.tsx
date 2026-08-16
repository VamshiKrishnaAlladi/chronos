import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ToolFace } from '../types'
import { ToolActionRow } from './ToolActionRow'

function createTool(status: ToolFace['status']): ToolFace {
  return {
    displayMs: 0,
    status,
    statusCopy: status,
    progress: 0,
    readoutBlinking: false,
    inputInvalid: false,
    inputDisabled: true,
    restartLabel: 'Restart',
    split: vi.fn(),
    start: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    stop: vi.fn(),
  }
}

describe('ToolActionRow split timer controls', () => {
  it('offers split, pause, and stop while running', async () => {
    const user = userEvent.setup()
    const tool = createTool('running')

    render(
      <ToolActionRow
        tool={tool}
        isIdle={false}
        isRunning={true}
        startLabel="Start Timer"
        className="controls"
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Split' }))
    await user.click(screen.getByRole('button', { name: 'Pause' }))
    await user.click(screen.getByRole('button', { name: 'Stop' }))

    expect(tool.split).toHaveBeenCalledOnce()
    expect(tool.pause).toHaveBeenCalledOnce()
    expect(tool.stop).toHaveBeenCalledOnce()
  })

  it('offers resume without clearing the paused session', async () => {
    const user = userEvent.setup()
    const tool = createTool('paused')

    render(
      <ToolActionRow
        tool={tool}
        isIdle={false}
        isRunning={false}
        startLabel="Start Timer"
        className="controls"
      />,
    )

    expect(screen.queryByRole('button', { name: 'Split' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Resume' }))

    expect(tool.resume).toHaveBeenCalledOnce()
    expect(tool.start).not.toHaveBeenCalled()
  })
})
