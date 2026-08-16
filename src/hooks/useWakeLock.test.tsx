import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useWakeLock } from './useWakeLock'

const originalWakeLock = Object.getOwnPropertyDescriptor(navigator, 'wakeLock')
const originalVisibilityState = Object.getOwnPropertyDescriptor(document, 'visibilityState')

function WakeLockHarness({ enabled, active }: { enabled: boolean; active: boolean }) {
  const wakeLock = useWakeLock({ enabled, active })
  return <output>{wakeLock.status}</output>
}

function createSentinel() {
  let releaseListener: (() => void) | undefined
  const sentinel = {
    released: false,
    release: vi.fn(async () => {
      sentinel.released = true
      releaseListener?.()
    }),
    addEventListener: vi.fn((_type: string, listener: () => void) => {
      releaseListener = listener
    }),
  }
  return sentinel
}

function setVisibility(value: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value })
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('useWakeLock', () => {
  beforeEach(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
  })

  afterEach(() => {
    if (originalWakeLock) Object.defineProperty(navigator, 'wakeLock', originalWakeLock)
    else Reflect.deleteProperty(navigator, 'wakeLock')
    if (originalVisibilityState) {
      Object.defineProperty(document, 'visibilityState', originalVisibilityState)
    } else {
      Reflect.deleteProperty(document, 'visibilityState')
    }
    vi.restoreAllMocks()
  })

  it('holds a lock only while enabled, running, and visible', async () => {
    const sentinel = createSentinel()
    const request = vi.fn().mockResolvedValue(sentinel)
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: { request },
    })

    const view = render(<WakeLockHarness enabled active />)
    await waitFor(() => expect(screen.getByText('active')).toBeInTheDocument())
    expect(request).toHaveBeenCalledWith('screen')

    view.rerender(<WakeLockHarness enabled active={false} />)
    await waitFor(() => expect(sentinel.release).toHaveBeenCalledTimes(1))
    expect(screen.getByText('idle')).toBeInTheDocument()
  })

  it('releases while hidden and reacquires after visibility returns', async () => {
    const firstSentinel = createSentinel()
    const secondSentinel = createSentinel()
    const request = vi.fn()
      .mockResolvedValueOnce(firstSentinel)
      .mockResolvedValueOnce(secondSentinel)
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: { request },
    })

    render(<WakeLockHarness enabled active />)
    await waitFor(() => expect(screen.getByText('active')).toBeInTheDocument())

    setVisibility('hidden')
    await waitFor(() => expect(firstSentinel.release).toHaveBeenCalledTimes(1))
    expect(screen.getByText('idle')).toBeInTheDocument()

    setVisibility('visible')
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.getByText('active')).toBeInTheDocument())
  })

  it('reports unsupported without requesting a lock', () => {
    Reflect.deleteProperty(navigator, 'wakeLock')
    render(<WakeLockHarness enabled active />)
    expect(screen.getByText('unsupported')).toBeInTheDocument()
  })
})
