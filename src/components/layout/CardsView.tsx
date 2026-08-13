import { useRef } from 'react'
import { useCardsStore, useSpacesStore } from '@/core/stores'
import { useViewMode } from '@/core/hooks'
import { useSelectionBox, SelectionBoxOverlay } from '../SelectionBox'
import { MasonryGrid } from './MasonryGrid'
import { CardList } from './CardList'

export function CardsView() {
  const activeSpaceId = useSpacesStore((s) => s.activeSpaceId)
  const getSpaceById = useSpacesStore((s) => s.getSpaceById)
  const getCardsBySpace = useCardsStore((s) => s.getCardsBySpace)
  const isLoading = useCardsStore((s) => s.isLoading)
  // getCardsBySpace reads these off the store rather than taking them as
  // arguments, so subscribe to each one to re-render when they change.
  useCardsStore((s) => s.cards)
  useCardsStore((s) => s.filterTags)
  useCardsStore((s) => s.searchQuery)

  const [viewMode] = useViewMode()
  const containerRef = useRef<HTMLDivElement>(null)
  const { selectionRect } = useSelectionBox(containerRef)

  const cards = getCardsBySpace(activeSpaceId)
  const activeSpace = activeSpaceId ? getSpaceById(activeSpaceId) : null

  return (
    <div ref={containerRef} className="relative min-h-[70vh]">
      <header className="flex items-baseline gap-3 mb-9">
        <h1 className="font-display text-title text-text-faint">
          {activeSpace?.name || 'All cards'}
        </h1>
        {!isLoading && (
          <span className="text-sm tabular-nums text-text-faint">{cards.length}</span>
        )}
      </header>

      {isLoading ? (
        <p className="text-sm text-text-faint animate-pulse">Loading…</p>
      ) : cards.length === 0 ? (
        <div className="pt-16">
          <p className="text-lg text-text-muted">Nothing here yet.</p>
          <p className="mt-1 text-sm text-text-faint">
            Use the + button to add your first card.
          </p>
        </div>
      ) : viewMode === 'list' ? (
        <CardList cards={cards} />
      ) : (
        <MasonryGrid cards={cards} />
      )}

      <SelectionBoxOverlay rect={selectionRect} />
    </div>
  )
}
