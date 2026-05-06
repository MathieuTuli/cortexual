import { useRef, useMemo } from 'react'
import Masonry from 'react-masonry-css'
import { useAppStore, useCardsStore, useSpacesStore } from '@/core/stores'
import { Card } from '../cards/Card'
import { useSelectionBox, SelectionBoxOverlay } from '../SelectionBox'
import type { ZoomLevel } from '@/core/stores/app-store'

// Breakpoint columns for each zoom level
// Lower zoom = more columns (smaller cards), higher zoom = fewer columns (bigger cards)
const breakpointsByZoom: Record<ZoomLevel, Record<number | 'default', number>> = {
  1: { default: 8, 1536: 7, 1280: 6, 1024: 5, 768: 4, 640: 2 },
  2: { default: 7, 1536: 6, 1280: 5, 1024: 4, 768: 3, 640: 2 },
  3: { default: 6, 1536: 5, 1280: 4, 1024: 3, 768: 2, 640: 1 },
  4: { default: 5, 1536: 4, 1280: 3, 1024: 2, 768: 2, 640: 1 },
  5: { default: 4, 1536: 3, 1280: 2, 1024: 2, 768: 1, 640: 1 },
}

export function MasonryGrid() {
  const activeSpaceId = useSpacesStore((s) => s.activeSpaceId)
  const _allCards = useCardsStore((s) => s.cards) // Subscribe to cards for reactivity
  const getCardsBySpace = useCardsStore((s) => s.getCardsBySpace)
  const isLoading = useCardsStore((s) => s.isLoading)
  // Subscribe to filter changes to trigger re-renders
  const _filterTags = useCardsStore((s) => s.filterTags)
  const _searchQuery = useCardsStore((s) => s.searchQuery)
  void _filterTags, _searchQuery, _allCards // Subscribed for reactivity
  const containerRef = useRef<HTMLDivElement>(null)
  const { selectionRect } = useSelectionBox(containerRef)

  // Get zoom level from store
  const zoomLevel = useAppStore((s) => s.zoomLevel)
  const breakpointColumns = useMemo(() => breakpointsByZoom[zoomLevel], [zoomLevel])

  // getCardsBySpace uses filterTags and searchQuery internally
  const cards = getCardsBySpace(activeSpaceId)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-text-muted animate-pulse text-lg">⏳ Loading...</p>
        </div>
      </div>
    )
  }

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <div className="bg-gradient-to-b from-white to-[#e8f4fc] border-2 border-[#a8d4f0] rounded-lg p-8 shadow-y2k">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-lg text-text-muted mb-2">No cards yet!</p>
          <p className="text-sm text-text-muted">
            Click <strong>➕ New Card</strong> to get started.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative masonry-grid min-h-full">
      <Masonry
        breakpointCols={breakpointColumns}
        className="flex -ml-2 w-auto"
        columnClassName="pl-2 bg-clip-padding"
      >
        {cards.map((card) => (
          <div key={card.id} className="mb-2 min-w-0">
            <Card card={card} />
          </div>
        ))}
      </Masonry>
      <SelectionBoxOverlay rect={selectionRect} />
    </div>
  )
}
