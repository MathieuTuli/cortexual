import { create } from 'zustand'
import { api } from '../api'
import type { CanvasLayout, CardPosition, Layouts } from '../types'

/** How long to sit on drag updates before writing them to disk. */
const FLUSH_DELAY_MS = 400

interface Pending {
  positions: Record<string, CardPosition>
  removed: Set<string>
}

const pending = new Map<string, Pending>()
const timers = new Map<string, ReturnType<typeof setTimeout>>()

function queueFlush(canvasKey: string) {
  clearTimeout(timers.get(canvasKey))
  timers.set(
    canvasKey,
    setTimeout(() => {
      const batch = pending.get(canvasKey)
      pending.delete(canvasKey)
      timers.delete(canvasKey)
      if (!batch) return
      api.saveLayout(canvasKey, batch.positions, Array.from(batch.removed))
    }, FLUSH_DELAY_MS)
  )
}

interface LayoutState {
  layouts: Layouts
  isLoaded: boolean

  loadLayouts: () => Promise<void>
  getLayout: (canvasKey: string) => CanvasLayout
  setPositions: (canvasKey: string, positions: Record<string, CardPosition>) => void
  removePositions: (canvasKey: string, cardIds: string[]) => void
  /** Write any queued changes immediately — call before the page goes away. */
  flush: () => Promise<void>
}

const EMPTY: CanvasLayout = {}

export const useLayoutStore = create<LayoutState>((set, get) => ({
  layouts: {},
  isLoaded: false,

  loadLayouts: async () => {
    const layouts = await api.getLayouts()
    set({ layouts: layouts || {}, isLoaded: true })
  },

  getLayout: (canvasKey) => get().layouts[canvasKey] || EMPTY,

  setPositions: (canvasKey, positions) => {
    set((state) => ({
      layouts: {
        ...state.layouts,
        [canvasKey]: { ...(state.layouts[canvasKey] || {}), ...positions },
      },
    }))

    const batch = pending.get(canvasKey) || { positions: {}, removed: new Set<string>() }
    Object.assign(batch.positions, positions)
    for (const id of Object.keys(positions)) batch.removed.delete(id)
    pending.set(canvasKey, batch)
    queueFlush(canvasKey)
  },

  removePositions: (canvasKey, cardIds) => {
    set((state) => {
      const next = { ...(state.layouts[canvasKey] || {}) }
      for (const id of cardIds) delete next[id]
      return { layouts: { ...state.layouts, [canvasKey]: next } }
    })

    const batch = pending.get(canvasKey) || { positions: {}, removed: new Set<string>() }
    for (const id of cardIds) {
      delete batch.positions[id]
      batch.removed.add(id)
    }
    pending.set(canvasKey, batch)
    queueFlush(canvasKey)
  },

  flush: async () => {
    const writes = Array.from(pending.entries()).map(([canvasKey, batch]) => {
      clearTimeout(timers.get(canvasKey))
      timers.delete(canvasKey)
      return api.saveLayout(canvasKey, batch.positions, Array.from(batch.removed))
    })
    pending.clear()
    await Promise.all(writes)
  },
}))
