import { create } from 'zustand'
import { api } from '../api'
import type { Card, CardType, CreateCardInput, UpdateCardInput } from '../types'
import { cardIsInProject, cardIsInSpace, libraryCards } from '../types'
import { generateId } from '../utils'

export type MembershipField = 'spaceIds' | 'projectIds'

/**
 * The card's new membership list, or null when it already reads that way.
 * Returning null is what keeps an unchanged card from being rewritten to disk.
 */
function nextMembership(
  current: string[],
  id: string,
  action: 'add' | 'remove'
): string[] | null {
  const present = current.includes(id)
  if (action === 'add') return present ? null : [...current, id]
  return present ? current.filter((x) => x !== id) : null
}

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
  filterTypes: CardType[]
  /** Card ids from the semantic index, best first. Empty until it answers. */
  semanticIds: string[]

  loadCards: () => Promise<void>
  createCard: (input: CreateCardInput, mediaBlobs?: Blob | Blob[]) => Promise<Card>
  createCards: (newCards: NewCard[], onProgress?: (done: number, total: number) => void) => Promise<Card[]>
  updateCard: (id: string, changes: UpdateCardInput) => Promise<void>
  deleteCard: (id: string) => Promise<void>
  /**
   * Add or remove one space/project across a set of cards, or across every
   * card when cardIds is null.
   */
  setMembership: (
    cardIds: string[] | null,
    field: MembershipField,
    id: string,
    action: 'add' | 'remove'
  ) => Promise<void>
  setSearchQuery: (query: string) => void
  setSemanticIds: (ids: string[]) => void
  setFilterTags: (tags: string[]) => void
  addFilterTag: (tag: string) => void
  removeFilterTag: (tag: string) => void
  toggleFilterType: (type: CardType) => void
  clearFilters: () => void
  getCardsBySpace: (spaceId: string | null) => Card[]
  getCardsByProject: (projectId: string) => Card[]
  getAllTags: () => string[]
}

export const useCardsStore = create<CardsState>((set, get) => ({
  cards: [],
  isLoading: false,
  error: null,
  searchQuery: '',
  filterTags: [],
  filterTypes: [],
  semanticIds: [],

  loadCards: async () => {
    set({ isLoading: true })
    try {
      const allCards = await api.getCards()
      const cards = allCards
        // Cards created before projects existed have no projectIds field.
        // Normalize them at the boundary so every project-aware action can
        // safely treat them as belonging to no projects.
        .map((c: Card) => ({
          ...c,
          projectIds: Array.isArray(c.projectIds) ? c.projectIds : [],
        }))
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
    if (mediaBlobs && (input.type === 'image' || input.type === 'video' || input.type === 'pdf')) {
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

  setMembership: async (cardIds, field, id, action) => {
    const updatedAt = new Date().toISOString()
    const only = cardIds && new Set(cardIds)

    const changes = new Map<string, string[]>()
    for (const card of get().cards) {
      if (only && !only.has(card.id)) continue
      const next = nextMembership(card[field], id, action)
      if (next) changes.set(card.id, next)
    }
    if (changes.size === 0) return

    set((state) => ({
      cards: state.cards.map((c) =>
        changes.has(c.id) ? ({ ...c, [field]: changes.get(c.id)!, updatedAt } as Card) : c
      ),
    }))

    for (const [cardId, ids] of changes) {
      await api.updateCard(cardId, { [field]: ids, updatedAt })
    }
  },

  setSearchQuery: (query) => {
    // Drop stale semantic hits immediately; the new ones arrive async.
    set({ searchQuery: query, semanticIds: [] })
  },

  setSemanticIds: (ids) => {
    set({ semanticIds: ids })
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

  toggleFilterType: (type) => {
    set((state) => ({
      filterTypes: state.filterTypes.includes(type)
        ? state.filterTypes.filter((t) => t !== type)
        : [...state.filterTypes, type],
    }))
  },

  clearFilters: () => {
    set({ searchQuery: '', filterTags: [], filterTypes: [], semanticIds: [] })
  },

  getCardsBySpace: (spaceId) => {
    const { cards, searchQuery, filterTags, filterTypes } = get()

    // Project documents are not library cards; a doc has no space, so this
    // only actually changes All cards, where they would otherwise turn up.
    const visible = libraryCards(cards)
    let filtered = spaceId ? visible.filter((c) => cardIsInSpace(c, spaceId)) : visible

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const literal = (c: Card) => {
        const title = c.title?.toLowerCase() || ''
        const tags = c.tags.join(' ').toLowerCase()
        const content = 'content' in c ? (c.content as string).toLowerCase() : ''
        return title.includes(query) || tags.includes(query) || content.includes(query)
      }

      // Literal matches lead, in their existing order — if you typed a word
      // that's actually on a card, that card should be first. Semantic hits
      // follow, ranked by score, so the substring path never gets worse.
      const { semanticIds } = get()
      const exact = filtered.filter(literal)
      const seen = new Set(exact.map((c) => c.id))
      const rank = new Map(semanticIds.map((id, i) => [id, i]))

      const nearby = filtered
        .filter((c) => !seen.has(c.id) && rank.has(c.id))
        .sort((a, b) => rank.get(a.id)! - rank.get(b.id)!)

      filtered = [...exact, ...nearby]
    }

    if (filterTags.length > 0) {
      filtered = filtered.filter((c) =>
        filterTags.every((tag) => c.tags.includes(tag))
      )
    }

    if (filterTypes.length > 0) {
      filtered = filtered.filter((c) => filterTypes.includes(c.type))
    }

    return filtered
  },

  getCardsByProject: (projectId) => {
    return get().cards.filter((c) => cardIsInProject(c, projectId))
  },

  getAllTags: () => {
    const { cards } = get()
    const tagSet = new Set<string>()
    cards.forEach((c) => c.tags.forEach((t) => tagSet.add(t)))
    return Array.from(tagSet).sort()
  },
}))
