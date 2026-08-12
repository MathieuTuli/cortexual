import { create } from 'zustand'
import { api } from '../api'
import type { Card } from '../types'
import { cardText, textHash } from '../search/card-text'
import { Embedder } from '../search/embedder'
import { decodeVector, encodeVector, similarity, topK, type Scored } from '../search/vector'

/** Cards per worker round trip. Big enough to amortise, small enough to stream progress. */
const BATCH_SIZE = 32

export type IndexStatus = 'idle' | 'loading' | 'indexing' | 'ready' | 'error'

interface SearchState {
  vectors: Map<string, Float32Array>
  hashes: Map<string, string>
  status: IndexStatus
  progress: { done: number; total: number } | null
  error: string | null

  loadIndex: () => Promise<void>
  /** Embed anything new or edited, and forget cards that are gone. */
  syncIndex: (cards: Card[]) => Promise<void>
  searchIds: (query: string, limit?: number) => Promise<Scored<string>[]>
  relatedIds: (cardId: string, limit?: number) => Scored<string>[]
}

let embedder: Embedder | null = null
function getEmbedder(): Embedder {
  if (!embedder) embedder = new Embedder()
  return embedder
}

export const useSearchStore = create<SearchState>((set, get) => ({
  vectors: new Map(),
  hashes: new Map(),
  status: 'idle',
  progress: null,
  error: null,

  loadIndex: async () => {
    set({ status: 'loading' })
    try {
      const stored = await api.getEmbeddings()
      const vectors = new Map<string, Float32Array>()
      const hashes = new Map<string, string>()
      for (const [cardId, entry] of Object.entries(stored || {})) {
        vectors.set(cardId, decodeVector(entry.vector))
        hashes.set(cardId, entry.hash)
      }
      set({ vectors, hashes, status: 'ready' })
    } catch (error) {
      set({ status: 'error', error: (error as Error).message })
    }
  },

  syncIndex: async (cards) => {
    const { hashes, vectors } = get()

    const stale = cards.filter((card) => hashes.get(card.id) !== textHash(cardText(card)))
    const live = new Set(cards.map((c) => c.id))
    const orphaned = Array.from(vectors.keys()).filter((id) => !live.has(id))

    if (stale.length === 0 && orphaned.length === 0) {
      set({ status: 'ready', progress: null })
      return
    }

    if (orphaned.length > 0) {
      set((state) => {
        const nextVectors = new Map(state.vectors)
        const nextHashes = new Map(state.hashes)
        for (const id of orphaned) {
          nextVectors.delete(id)
          nextHashes.delete(id)
        }
        return { vectors: nextVectors, hashes: nextHashes }
      })
      await api.saveEmbeddings({}, orphaned)
    }

    if (stale.length === 0) {
      set({ status: 'ready', progress: null })
      return
    }

    set({ status: 'indexing', progress: { done: 0, total: stale.length }, error: null })

    try {
      for (let i = 0; i < stale.length; i += BATCH_SIZE) {
        const batch = stale.slice(i, i + BATCH_SIZE)
        const texts = batch.map(cardText)
        const embedded = await getEmbedder().embed(texts)

        const entries: Record<string, { hash: string; vector: string }> = {}
        set((state) => {
          const nextVectors = new Map(state.vectors)
          const nextHashes = new Map(state.hashes)
          batch.forEach((card, n) => {
            const hash = textHash(texts[n])
            nextVectors.set(card.id, embedded[n])
            nextHashes.set(card.id, hash)
            entries[card.id] = { hash, vector: encodeVector(embedded[n]) }
          })
          return {
            vectors: nextVectors,
            hashes: nextHashes,
            progress: { done: Math.min(i + BATCH_SIZE, stale.length), total: stale.length },
          }
        })

        await api.saveEmbeddings(entries)
      }

      set({ status: 'ready', progress: null })
    } catch (error) {
      set({ status: 'error', error: (error as Error).message, progress: null })
    }
  },

  searchIds: async (query, limit = 60) => {
    const trimmed = query.trim()
    if (!trimmed) return []

    const [queryVector] = await getEmbedder().embed([trimmed])
    if (!queryVector) return []

    const scored: Scored<string>[] = []
    for (const [cardId, vector] of get().vectors) {
      scored.push({ item: cardId, score: similarity(queryVector, vector) })
    }
    // MiniLM puts unrelated short texts around 0.1-0.2; below this is noise.
    return topK(scored, limit, 0.25)
  },

  relatedIds: (cardId, limit = 6) => {
    const { vectors } = get()
    const target = vectors.get(cardId)
    if (!target) return []

    const scored: Scored<string>[] = []
    for (const [otherId, vector] of vectors) {
      if (otherId === cardId) continue
      scored.push({ item: otherId, score: similarity(target, vector) })
    }
    return topK(scored, limit, 0.3)
  },
}))
