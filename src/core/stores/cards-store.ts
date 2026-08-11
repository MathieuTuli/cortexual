import { create } from 'zustand'
import { api } from '../api'
import type { Card, CreateCardInput, UpdateCardInput } from '../types'
import { generateId } from '../utils'

export interface NewCard {
  input: CreateCardInput
  blobs?: Blob[]
}

interface CardsState {
  cards: Card[]
  isLoading: boolean
  error: string | null
  searchQuery: string
  filterTags: string[]

  loadCards: () => Promise<void>
  createCard: (input: CreateCardInput, mediaBlobs?: Blob | Blob[]) => Promise<Card>
  createCards: (newCards: NewCard[], onProgress?: (done: number, total: number) => void) => Promise<Card[]>
  updateCard: (id: string, changes: UpdateCardInput) => Promise<void>
  deleteCard: (id: string) => Promise<void>
  deleteCardsBySpaceId: (spaceId: string) => Promise<void>
  moveCardsToSpace: (cardIds: string[], spaceId: string) => Promise<void>
  setSearchQuery: (query: string) => void
  setFilterTags: (tags: string[]) => void
  addFilterTag: (tag: string) => void
  removeFilterTag: (tag: string) => void
  clearFilters: () => void
  getCardsBySpace: (spaceId: string | null) => Card[]
  getAllTags: () => string[]
}

export const useCardsStore = create<CardsState>((set, get) => ({
  cards: [],
  isLoading: false,
  error: null,
  searchQuery: '',
  filterTags: [],

  loadCards: async () => {
    set({ isLoading: true })
    try {
      const allCards = await api.getCards()
      const cards = allCards
        .filter((c: Card) => c.deletedAt === null)
        .sort((a: Card, b: Card) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      set({ cards, isLoading: false })
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false })
    }
  },

  createCard: async (input, mediaBlobs) => {
    const now = new Date().toISOString()
    const cardId = generateId()

    const card: Card = {
      ...input,
      id: cardId,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    } as Card

    // Save card to file
    await api.createCard(card)

    // Upload media blobs if provided
    if (mediaBlobs && (input.type === 'image' || input.type === 'video')) {
      const blobs = Array.isArray(mediaBlobs) ? mediaBlobs : [mediaBlobs]
      for (const blob of blobs) {
        await api.uploadMedia(cardId, blob)
      }
    }

    set((state) => ({ cards: [card, ...state.cards] }))
    return card
  },

  createCards: async (newCards, onProgress) => {
    const now = new Date().toISOString()
    const cards = newCards.map(({ input }) => ({
      ...input,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    } as Card))

    await api.createCardsBulk(cards)

    // Media has to land before the cards enter the store, otherwise the grid
    // renders them and reads back an empty media directory.
    for (let i = 0; i < newCards.length; i++) {
      for (const blob of newCards[i].blobs ?? []) {
        await api.uploadMedia(cards[i].id, blob)
      }
      onProgress?.(i + 1, newCards.length)
    }

    set((state) => ({ cards: [...cards, ...state.cards] }))
    return cards
  },

  updateCard: async (id, changes) => {
    const updatedAt = new Date().toISOString()

    set((state) => ({
      cards: state.cards.map((c) =>
        c.id === id ? { ...c, ...changes, updatedAt } as Card : c
      ),
    }))

    await api.updateCard(id, { ...changes, updatedAt })
  },

  deleteCard: async (id) => {
    set((state) => ({
      cards: state.cards.filter((c) => c.id !== id),
    }))

    await api.deleteCard(id)
  },

  deleteCardsBySpaceId: async (spaceId) => {
    const { cards } = get()
    const cardsToDelete = cards.filter((c) => c.spaceId === spaceId)

    set((state) => ({
      cards: state.cards.filter((c) => c.spaceId !== spaceId),
    }))

    for (const card of cardsToDelete) {
      await api.deleteCard(card.id)
    }
  },

  moveCardsToSpace: async (cardIds, spaceId) => {
    const updatedAt = new Date().toISOString()

    set((state) => ({
      cards: state.cards.map((c) =>
        cardIds.includes(c.id) ? { ...c, spaceId, updatedAt } as Card : c
      ),
    }))

    for (const id of cardIds) {
      await api.updateCard(id, { spaceId, updatedAt })
    }
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query })
  },

  setFilterTags: (tags) => {
    set({ filterTags: tags })
  },

  addFilterTag: (tag) => {
    set((state) => ({
      filterTags: state.filterTags.includes(tag)
        ? state.filterTags
        : [...state.filterTags, tag],
    }))
  },

  removeFilterTag: (tag) => {
    set((state) => ({
      filterTags: state.filterTags.filter((t) => t !== tag),
    }))
  },

  clearFilters: () => {
    set({ searchQuery: '', filterTags: [] })
  },

  getCardsBySpace: (spaceId) => {
    const { cards, searchQuery, filterTags } = get()

    let filtered = spaceId
      ? cards.filter((c) => c.spaceId === spaceId)
      : cards

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((c) => {
        const title = c.title?.toLowerCase() || ''
        const tags = c.tags.join(' ').toLowerCase()
        const content = 'content' in c ? (c.content as string).toLowerCase() : ''
        return title.includes(query) || tags.includes(query) || content.includes(query)
      })
    }

    if (filterTags.length > 0) {
      filtered = filtered.filter((c) =>
        filterTags.every((tag) => c.tags.includes(tag))
      )
    }

    return filtered
  },

  getAllTags: () => {
    const { cards } = get()
    const tagSet = new Set<string>()
    cards.forEach((c) => c.tags.forEach((t) => tagSet.add(t)))
    return Array.from(tagSet).sort()
  },
}))
