import { create } from 'zustand'
import { api } from '../api'
import { decodeVector, similarity, topK, type Scored } from '../search/vector'

export type IndexStatus = 'idle' | 'loading' | 'indexing' | 'ready' | 'error'

interface SearchState {
  vectors: Map<string, Float32Array>
  hashes: Map<string, string>
  status: IndexStatus
  progress: { done: number; total: number } | null
  error: string | null

  loadIndex: () => Promise<void>
  syncIndex: () => Promise<void>
  relatedIds: (cardId: string, limit?: number) => Scored<string>[]
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

  /** Indexing runs on the server; this pulls the result back for related. */
  syncIndex: async () => {
    set({ status: 'indexing' })
    await api.reindex()
    await useSearchStore.getState().loadIndex()
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
