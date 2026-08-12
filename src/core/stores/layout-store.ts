import { create } from 'zustand'
import { api } from '../api'
import type { CardPosition, Layouts, SpaceLayout } from '../types'

/** How long to sit on drag updates before writing them to disk. */
const FLUSH_DELAY_MS = 400

interface Pending {
  positions: Record<string, CardPosition>
  removed: Set<string>
}

const pending = new Map<string, Pending>()
const timers = new Map<string, ReturnType<typeof setTimeout>>()

function queueFlush(spaceKey: string) {
  clearTimeout(timers.get(spaceKey))
  timers.set(
    spaceKey,
    setTimeout(() => {
      const batch = pending.get(spaceKey)
      pending.delete(spaceKey)
      timers.delete(spaceKey)
      if (!batch) return
      api.saveLayout(spaceKey, batch.positions, Array.from(batch.removed))
    }, FLUSH_DELAY_MS)
  )
}

interface LayoutState {
  layouts: Layouts
  isLoaded: boolean

  loadLayouts: () => Promise<void>
  getLayout: (spaceKey: string) => SpaceLayout
  setPositions: (spaceKey: string, positions: Record<string, CardPosition>) => void
  removePositions: (spaceKey: string, cardIds: string[]) => void
  /** Write any queued changes immediately — call before the page goes away. */
  flush: () => Promise<void>
}

const EMPTY: SpaceLayout = {}

export const useLayoutStore = create<LayoutState>((set, get) => ({
  layouts: {},
  isLoaded: false,

  loadLayouts: async () => {
    const layouts = await api.getLayouts()
    set({ layouts: layouts || {}, isLoaded: true })
  },

  getLayout: (spaceKey) => get().layouts[spaceKey] || EMPTY,

  setPositions: (spaceKey, positions) => {
    set((state) => ({
      layouts: {
        ...state.layouts,
        [spaceKey]: { ...(state.layouts[spaceKey] || {}), ...positions },
      },
    }))

    const batch = pending.get(spaceKey) || { positions: {}, removed: new Set<string>() }
    Object.assign(batch.positions, positions)
    for (const id of Object.keys(positions)) batch.removed.delete(id)
    pending.set(spaceKey, batch)
    queueFlush(spaceKey)
  },

  removePositions: (spaceKey, cardIds) => {
    set((state) => {
      const next = { ...(state.layouts[spaceKey] || {}) }
      for (const id of cardIds) delete next[id]
      return { layouts: { ...state.layouts, [spaceKey]: next } }
    })

    const batch = pending.get(spaceKey) || { positions: {}, removed: new Set<string>() }
    for (const id of cardIds) {
      delete batch.positions[id]
      batch.removed.add(id)
    }
    pending.set(spaceKey, batch)
    queueFlush(spaceKey)
  },

  flush: async () => {
    const writes = Array.from(pending.entries()).map(([spaceKey, batch]) => {
      clearTimeout(timers.get(spaceKey))
      timers.delete(spaceKey)
      return api.saveLayout(spaceKey, batch.positions, Array.from(batch.removed))
    })
    pending.clear()
    await Promise.all(writes)
  },
}))
