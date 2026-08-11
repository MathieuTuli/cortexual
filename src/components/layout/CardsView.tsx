import { useRef } from 'react'
import { useCardsStore, useSpacesStore } from '@/core/stores'
import { useViewMode } from '@/core/hooks'
import { useSelectionBox, SelectionBoxOverlay } from '../SelectionBox'
import { MasonryGrid } from './MasonryGrid'
import { CardList } from './CardList'

export function CardsView() {
  const activeSpaceId = useSpacesStore((s) => s.activeSpaceId)
  const getCardsBySpace = useCardsStore((s) => s.getCardsBySpace)
  const isLoading = useCardsStore((s) => s.isLoading)
  // getCardsBySpace reads these off the store, so subscribe to them for re-renders
  const _allCards = useCardsStore((s) => s.cards)
  const _filterTags = useCardsStore((s) => s.filterTags)
  const _searchQuery = useCardsStore((s) => s.searchQuery)
  void _allCards, _filterTags, _searchQuery

  const [viewMode] = useViewMode()
  const containerRef = useRef<HTMLDivElement>(null)
  const { selectionRect } = useSelectionBox(containerRef)

  const cards = getCardsBySpace(activeSpaceId)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-text-muted text-sm animate-pulse">Loading…</p>
      </div>
    )
  }

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <p className="text-base text-text mb-1">Nothing here yet.</p>
        <p className="text-sm text-text-muted">
          Hit <kbd className="px-1.5 py-0.5 bg-white border border-[var(--color-border)] rounded text-[11px]">Capture</kbd> to add your first card.
        </p>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative min-h-full">
      {viewMode === 'list' ? <CardList cards={cards} /> : <MasonryGrid cards={cards} />}
      <SelectionBoxOverlay rect={selectionRect} />
    </div>
  )
}
