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
})
