import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useScrolledPast } from './use-scrolled-past'

async function scrollTo(y: number) {
  await act(async () => {
    window.scrollY = y
    window.dispatchEvent(new Event('scroll'))
    await new Promise((r) => requestAnimationFrame(() => r(null)))
  })
}

beforeEach(() => {
  window.scrollY = 0
})

describe('useScrolledPast', () => {
  it('turns on past the threshold and off again well above it', async () => {
    const { result } = renderHook(() => useScrolledPast(140))
    await waitFor(() => expect(result.current).toBe(false))

    await scrollTo(139)
    expect(result.current).toBe(false)

    await scrollTo(141)
    expect(result.current).toBe(true)

    await scrollTo(0)
    expect(result.current).toBe(false)
  })

  it('holds steady when the position wobbles around the threshold', async () => {
    const { result } = renderHook(() => useScrolledPast(140))
    await scrollTo(150)
    expect(result.current).toBe(true)

    // Inside the hysteresis band: a trackpad drifting here must not flicker.
    for (const y of [139, 141, 132, 138, 130]) {
      await scrollTo(y)
      expect(result.current).toBe(true)
    }

    await scrollTo(110)
    expect(result.current).toBe(false)
  })

  it('stops listening once unmounted', async () => {
    const { result, unmount } = renderHook(() => useScrolledPast(140))
    await scrollTo(200)
    expect(result.current).toBe(true)

    unmount()
    // Would throw on a setState after unmount if the listener were still bound.
    await scrollTo(0)
  })
})
