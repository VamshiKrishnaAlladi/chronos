import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { PwaUpdatePrompt } from './PwaUpdatePrompt'

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: vi.fn(),
}))

const mockedUseRegisterSW = vi.mocked(useRegisterSW)
const setNeedRefresh = vi.fn()
const updateServiceWorker = vi.fn<() => Promise<void>>()

function mockPwaState(needRefresh: boolean) {
  mockedUseRegisterSW.mockReturnValue({
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [false, vi.fn()],
    updateServiceWorker,
  })
}

describe('PwaUpdatePrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    updateServiceWorker.mockResolvedValue()
  })

  it('stays hidden until a waiting service worker is ready', () => {
    mockPwaState(false)

    render(<PwaUpdatePrompt />)

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('only applies an update after explicit confirmation', async () => {
    const user = userEvent.setup()
    mockPwaState(true)

    render(<PwaUpdatePrompt />)

    expect(updateServiceWorker).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Update' }))
    expect(updateServiceWorker).toHaveBeenCalledWith(true)
  })

  it('lets the user defer a waiting update', async () => {
    const user = userEvent.setup()
    mockPwaState(true)

    render(<PwaUpdatePrompt />)
    await user.click(screen.getByRole('button', { name: 'Later' }))

    expect(setNeedRefresh).toHaveBeenCalledWith(false)
    expect(updateServiceWorker).not.toHaveBeenCalled()
  })
})
