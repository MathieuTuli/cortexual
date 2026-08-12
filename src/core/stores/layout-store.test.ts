import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const saveLayout = vi.fn().mockResolvedValue({})
const getLayouts = vi.fn().mockResolvedValue({})

vi.mock('../api', () => ({ api: { saveLayout: (...a: unknown[]) => saveLayout(...a), getLayouts: () => getLayouts() } }))

const { useLayoutStore } = await import('./layout-store')

const pos = (x: number, y: number) => ({ x, y, w: 260 })

describe('layout store', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    saveLayout.mockClear()
    getLayouts.mockClear()
    useLayoutStore.setState({ layouts: {}, isLoaded: false })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('applies a position to local state immediately', () => {
    useLayoutStore.getState().setPositions('s1', { c1: pos(10, 20) })
    expect(useLayoutStore.getState().getLayout('s1')).toEqual({ c1: pos(10, 20) })
  })

  it('does not write to the api before the debounce elapses', () => {
    useLayoutStore.getState().setPositions('s1', { c1: pos(10, 20) })
    expect(saveLayout).not.toHaveBeenCalled()
  })

  it('writes once after the debounce elapses', async () => {
    useLayoutStore.getState().setPositions('s1', { c1: pos(10, 20) })
    await vi.advanceTimersByTimeAsync(500)
    expect(saveLayout).toHaveBeenCalledTimes(1)
    expect(saveLayout).toHaveBeenCalledWith('s1', { c1: pos(10, 20) }, [])
  })

  it('collapses a burst of drag updates into one write with the final position', async () => {
    const { setPositions } = useLayoutStore.getState()
    for (let i = 0; i < 30; i++) setPositions('s1', { c1: pos(i, i) })
    await vi.advanceTimersByTimeAsync(500)

    expect(saveLayout).toHaveBeenCalledTimes(1)
    expect(saveLayout).toHaveBeenCalledWith('s1', { c1: pos(29, 29) }, [])
  })

  it('keeps separate spaces in separate writes', async () => {
    const { setPositions } = useLayoutStore.getState()
    setPositions('s1', { c1: pos(1, 1) })
    setPositions('s2', { c2: pos(2, 2) })
    await vi.advanceTimersByTimeAsync(500)

    expect(saveLayout).toHaveBeenCalledTimes(2)
    expect(saveLayout).toHaveBeenCalledWith('s1', { c1: pos(1, 1) }, [])
    expect(saveLayout).toHaveBeenCalledWith('s2', { c2: pos(2, 2) }, [])
  })

  it('leaves other cards in the space alone', () => {
    const { setPositions } = useLayoutStore.getState()
    setPositions('s1', { c1: pos(1, 1) })
    setPositions('s1', { c2: pos(2, 2) })
    expect(useLayoutStore.getState().getLayout('s1')).toEqual({ c1: pos(1, 1), c2: pos(2, 2) })
  })

  it('removes a position locally and reports it to the api', async () => {
    const { setPositions, removePositions } = useLayoutStore.getState()
    setPositions('s1', { c1: pos(1, 1), c2: pos(2, 2) })
    await vi.advanceTimersByTimeAsync(500)
    saveLayout.mockClear()

    removePositions('s1', ['c1'])
    expect(useLayoutStore.getState().getLayout('s1')).toEqual({ c2: pos(2, 2) })

    await vi.advanceTimersByTimeAsync(500)
    expect(saveLayout).toHaveBeenCalledWith('s1', {}, ['c1'])
  })

  it('does not resurrect a card that was moved and then removed in one batch', async () => {
    const { setPositions, removePositions } = useLayoutStore.getState()
    setPositions('s1', { c1: pos(1, 1) })
    removePositions('s1', ['c1'])
    await vi.advanceTimersByTimeAsync(500)

    expect(saveLayout).toHaveBeenCalledWith('s1', {}, ['c1'])
  })

  it('does not re-delete a card that was removed and then placed again', async () => {
    const { setPositions, removePositions } = useLayoutStore.getState()
    removePositions('s1', ['c1'])
    setPositions('s1', { c1: pos(5, 5) })
    await vi.advanceTimersByTimeAsync(500)

    expect(saveLayout).toHaveBeenCalledWith('s1', { c1: pos(5, 5) }, [])
  })

  it('flush writes pending changes without waiting for the timer', async () => {
    useLayoutStore.getState().setPositions('s1', { c1: pos(9, 9) })
    await useLayoutStore.getState().flush()

    expect(saveLayout).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1000)
    expect(saveLayout).toHaveBeenCalledTimes(1)
  })

  it('flush is a no-op when nothing is pending', async () => {
    await useLayoutStore.getState().flush()
    expect(saveLayout).not.toHaveBeenCalled()
  })

  it('returns an empty layout for a space nobody has touched', () => {
    expect(useLayoutStore.getState().getLayout('never-seen')).toEqual({})
  })
})
