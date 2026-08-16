import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from './ConfirmDialog'

function DialogHarness({ onCancel = () => {} }: { onCancel?: () => void }) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>Open confirmation</button>
      {open && (
        <ConfirmDialog
          message="The active timer will be stopped."
          confirmLabel="Switch"
          onConfirm={() => setOpen(false)}
          onCancel={() => {
            onCancel()
            setOpen(false)
          }}
        />
      )}
    </div>
  )
}

describe('ConfirmDialog', () => {
  it('is labelled, described, modal, and isolates the background', async () => {
    const user = userEvent.setup()
    render(<DialogHarness />)

    const opener = screen.getByRole('button', { name: 'Open confirmation' })
    await user.click(opener)

    const dialog = screen.getByRole('alertdialog')
    expect(dialog).toHaveAccessibleName('Confirm action')
    expect(dialog).toHaveAccessibleDescription('The active timer will be stopped.')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(opener).toHaveAttribute('aria-hidden', 'true')
    expect(opener.inert).toBe(true)
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
  })

  it('traps focus, closes with Escape, restores focus, and removes isolation', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(<DialogHarness onCancel={onCancel} />)

    const opener = screen.getByRole('button', { name: 'Open confirmation' })
    await user.click(opener)
    const cancel = screen.getByRole('button', { name: 'Cancel' })
    const confirm = screen.getByRole('button', { name: 'Switch' })

    await user.tab()
    expect(confirm).toHaveFocus()
    await user.tab()
    expect(cancel).toHaveFocus()
    await user.tab({ shift: true })
    expect(confirm).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalledOnce()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
    expect(opener).not.toHaveAttribute('aria-hidden')
    expect(opener.inert).not.toBe(true)
  })
})
