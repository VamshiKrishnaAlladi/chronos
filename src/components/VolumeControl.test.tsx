import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { VolumeControl } from './VolumeControl'

describe('VolumeControl', () => {
  it('opens the slider and reports volume changes', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(<VolumeControl volume={30} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: /sound/i }))
    fireEvent.change(screen.getByRole('slider', { name: /sound volume/i }), {
      target: { value: '40' },
    })

    expect(onChange).toHaveBeenCalledWith(40)
  })

  it('shows off state at zero volume', () => {
    render(<VolumeControl volume={0} onChange={() => {}} />)

    expect(screen.getByText('Off')).toBeInTheDocument()
  })

  it('exposes a disclosure relationship and restores focus on Escape', async () => {
    const user = userEvent.setup()
    render(<VolumeControl volume={30} onChange={() => {}} />)

    const trigger = screen.getByRole('button', { name: /sound/i })
    await user.click(trigger)
    const slider = screen.getByRole('slider', { name: /sound volume/i })

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(trigger).toHaveAttribute('aria-controls', slider.closest('.volume-popup')?.id)

    slider.focus()
    await user.keyboard('{Escape}')
    expect(trigger).toHaveFocus()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })
})
