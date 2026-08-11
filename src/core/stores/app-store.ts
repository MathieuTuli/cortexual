import { create } from 'zustand'
import type { CardType, ViewMode } from '../types'

// Zoom level 1 = most zoomed out (more columns, smaller cards)
// Zoom level 5 = most zoomed in (fewer columns, larger cards)
export type ZoomLevel = 1 | 2 | 3 | 4 | 5

// Real spaces persist their view mode in spaces.json; "All cards" has no
// record to hang it off, so it lives here.
const ALL_CARDS_VIEW_MODE_KEY = 'cortexual:all-cards-view-mode'

interface AppState {
  isCreateModalOpen: boolean
  isEditModalOpen: boolean
  isViewModalOpen: boolean
  editingCardId: string | null
  viewingCardId: string | null
  createModalDefaultType: CardType

  // Selection state
  selectedCardIds: Set<string>
  isSelecting: boolean

  // Zoom state
  zoomLevel: ZoomLevel

  // View mode for the "All cards" pseudo-space
  allCardsViewMode: ViewMode

  openCreateModal: (defaultType?: CardType) => void
  closeCreateModal: () => void
  openEditModal: (cardId: string) => void
  closeEditModal: () => void
  openViewModal: (cardId: string) => void
  closeViewModal: () => void

  // Selection actions
  selectCard: (cardId: string) => void
  deselectCard: (cardId: string) => void
  toggleCardSelection: (cardId: string) => void
  selectCards: (cardIds: string[]) => void
  clearSelection: () => void
  setIsSelecting: (isSelecting: boolean) => void

  // Zoom actions
  zoomIn: () => void
  zoomOut: () => void
  setZoomLevel: (level: ZoomLevel) => void

  setAllCardsViewMode: (mode: ViewMode) => void
}

export const useAppStore = create<AppState>((set) => ({
  isCreateModalOpen: false,
  isEditModalOpen: false,
  isViewModalOpen: false,
  editingCardId: null,
  viewingCardId: null,
  createModalDefaultType: 'note',

  // Selection state
  selectedCardIds: new Set<string>(),
  isSelecting: false,

  // Zoom state (default to middle zoom level)
  zoomLevel: 3,

  allCardsViewMode: localStorage.getItem(ALL_CARDS_VIEW_MODE_KEY) === 'list' ? 'list' : 'grid',

  openCreateModal: (defaultType = 'note') => {
    set({ isCreateModalOpen: true, createModalDefaultType: defaultType })
  },

  closeCreateModal: () => {
    set({ isCreateModalOpen: false })
  },

  openEditModal: (cardId) => {
    set({ isEditModalOpen: true, editingCardId: cardId, isViewModalOpen: false })
  },

  closeEditModal: () => {
    set({ isEditModalOpen: false, editingCardId: null })
  },

  openViewModal: (cardId) => {
    set({ isViewModalOpen: true, viewingCardId: cardId })
  },

  closeViewModal: () => {
    set({ isViewModalOpen: false, viewingCardId: null })
  },

  // Selection actions
  selectCard: (cardId) => {
    set((state) => {
      const newSet = new Set(state.selectedCardIds)
      newSet.add(cardId)
      return { selectedCardIds: newSet }
    })
  },

  deselectCard: (cardId) => {
    set((state) => {
      const newSet = new Set(state.selectedCardIds)
      newSet.delete(cardId)
      return { selectedCardIds: newSet }
    })
  },

  toggleCardSelection: (cardId) => {
    set((state) => {
      const newSet = new Set(state.selectedCardIds)
      if (newSet.has(cardId)) {
        newSet.delete(cardId)
      } else {
        newSet.add(cardId)
      }
      return { selectedCardIds: newSet }
    })
  },

  selectCards: (cardIds) => {
    set((state) => {
      const newSet = new Set(state.selectedCardIds)
      cardIds.forEach((id) => newSet.add(id))
      return { selectedCardIds: newSet }
    })
  },

  clearSelection: () => {
    set({ selectedCardIds: new Set<string>() })
  },

  setIsSelecting: (isSelecting) => {
    set({ isSelecting })
  },

  // Zoom actions
  zoomIn: () => {
    set((state) => ({
      zoomLevel: Math.min(5, state.zoomLevel + 1) as ZoomLevel,
    }))
  },

  zoomOut: () => {
    set((state) => ({
      zoomLevel: Math.max(1, state.zoomLevel - 1) as ZoomLevel,
    }))
  },

  setZoomLevel: (level) => {
    set({ zoomLevel: level })
  },

  setAllCardsViewMode: (mode) => {
    localStorage.setItem(ALL_CARDS_VIEW_MODE_KEY, mode)
    set({ allCardsViewMode: mode })
  },
}))
