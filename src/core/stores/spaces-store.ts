import { create } from 'zustand'
import { api } from '../api'
import type { Space, CreateSpaceInput, UpdateSpaceInput } from '../types'
import { generateId } from '../utils'
import { useCardsStore } from './cards-store'

// Y2K-inspired color palette
const SPACE_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#0ea5e9', // sky
  '#6366f1', // indigo
  '#a855f7', // purple
  '#ec4899', // pink
]

function getRandomColor(): string {
  return SPACE_COLORS[Math.floor(Math.random() * SPACE_COLORS.length)]
}

interface SpacesState {
  spaces: Space[]
  isLoading: boolean
  error: string | null
  activeSpaceId: string | null

  initialize: () => Promise<void>
  loadSpaces: () => Promise<void>
  createSpace: (input: CreateSpaceInput) => Promise<Space>
  updateSpace: (id: string, changes: UpdateSpaceInput) => Promise<void>
  deleteSpace: (id: string) => Promise<void>
  reorderSpaces: (fromIndex: number, toIndex: number) => Promise<void>
  setActiveSpace: (id: string | null) => void
  getSpaceById: (id: string) => Space | undefined
}

export const useSpacesStore = create<SpacesState>((set, get) => ({
  spaces: [],
  isLoading: false,
  error: null,
  activeSpaceId: null,

  initialize: async () => {
    await get().loadSpaces()
  },

  loadSpaces: async () => {
    set({ isLoading: true })
    try {
      const allSpaces = await api.getSpaces()
      const spaces = allSpaces
        .filter((s: Space) => s.deletedAt === null)
        .sort((a: Space, b: Space) => a.sortOrder - b.sortOrder)
      set({ spaces, isLoading: false })
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false })
    }
  },

  createSpace: async (input) => {
    const now = new Date().toISOString()
    const existingSpaces = get().spaces
    const space: Space = {
      id: generateId(),
      name: input.name,
      description: input.description,
      color: input.color || getRandomColor(),
      icon: input.icon,
      isDefault: false,
      sortOrder: existingSpaces.length,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    }

    set((state) => ({ spaces: [...state.spaces, space] }))
    await api.createSpace(space)
    return space
  },

  updateSpace: async (id, changes) => {
    const updatedAt = new Date().toISOString()

    set((state) => ({
      spaces: state.spaces.map((s) =>
        s.id === id ? { ...s, ...changes, updatedAt } : s
      ),
    }))

    await api.updateSpace(id, { ...changes, updatedAt })
  },

  deleteSpace: async (id) => {
    const space = get().spaces.find((s) => s.id === id)
    if (space?.isDefault) {
      throw new Error('Cannot delete default space')
    }

    // Unfile the cards rather than deleting them — a card may live in other
    // spaces too, and one that doesn't just becomes uncategorized.
    await useCardsStore.getState().removeSpaceFromCards(id)

    set((state) => ({
      spaces: state.spaces.filter((s) => s.id !== id),
    }))

    await api.deleteSpace(id)
  },

  reorderSpaces: async (fromIndex, toIndex) => {
    const spaces = [...get().spaces]
    const [movedSpace] = spaces.splice(fromIndex, 1)
    spaces.splice(toIndex, 0, movedSpace)

    const updatedSpaces = spaces.map((space, index) => ({
      ...space,
      sortOrder: index,
      updatedAt: new Date().toISOString(),
    }))

    set({ spaces: updatedSpaces })

    await Promise.all(
      updatedSpaces.map((space) =>
        api.updateSpace(space.id, { sortOrder: space.sortOrder, updatedAt: space.updatedAt })
      )
    )
  },

  setActiveSpace: (id) => {
    set({ activeSpaceId: id })
  },

  getSpaceById: (id) => {
    return get().spaces.find((s) => s.id === id)
  },
}))
