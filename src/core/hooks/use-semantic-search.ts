import { useEffect } from 'react'
import { useCardsStore, useSearchStore } from '../stores'
import { api } from '../api'

/** Wait this long after the last keystroke before embedding the query. */
const QUERY_DEBOUNCE_MS = 220

/**
 * Keeps the embedding index in step with the library, and turns whatever is in
 * the search box into semantic hits. Mount once, at the app root.
 */
export function useSemanticSearch() {
  const cards = useCardsStore((s) => s.cards)
  const searchQuery = useCardsStore((s) => s.searchQuery)
  const setSemanticIds = useCardsStore((s) => s.setSemanticIds)

  const status = useSearchStore((s) => s.status)
  const loadIndex = useSearchStore((s) => s.loadIndex)
  const syncIndex = useSearchStore((s) => s.syncIndex)

  useEffect(() => {
    void loadIndex()
  }, [loadIndex])

  // Re-index whenever the library changes. syncIndex diffs by content hash, so
  // an unchanged library costs one pass over the cards and no model work.
  useEffect(() => {
    if (status === 'idle' || status === 'loading' || cards.length === 0) return
    void syncIndex(cards)
    // Deliberately not keyed on `status`: syncIndex sets it, which would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, syncIndex])

  useEffect(() => {
    const query = searchQuery.trim()
    if (!query) {
      setSemanticIds([])
      return
    }

    let cancelled = false
    const timer = setTimeout(() => {
      api.search(query).then(
        (hits) => {
          if (!cancelled) setSemanticIds(hits.map((h) => h.id))
        },
        () => {
          // A failed query just means no semantic hits; the substring match
          // still stands on its own.
          if (!cancelled) setSemanticIds([])
        }
      )
    }, QUERY_DEBOUNCE_MS)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [searchQuery, setSemanticIds])
}
