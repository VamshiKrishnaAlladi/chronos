import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TileMenu } from './TileMenu'

describe('TileMenu disclosure', () => {
  it('uses disclosure semantics and restores trigger focus on Escape', async () => {
    const user = userEvent.setup()
    render(
      <TileMenu
        currentKind="countdown"
        status="idle"
        onChangeKind={vi.fn()}
        onRemove={vi.fn()}
      />,
    )

    const trigger = screen.getByRole('button', { name: 'Tile options' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    const dropdownId = trigger.getAttribute('aria-controls')
    expect(dropdownId).toBeTruthy()
    expect(document.getElementById(dropdownId!)).toBeInTheDocument()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()

    const firstOption = screen.getByRole('button', { name: 'Switch to Split Timer' })
    firstOption.focus()
    await user.keyboard('{Escape}')

    expect(trigger).toHaveFocus()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(firstOption).not.toBeInTheDocument()
  })
})
