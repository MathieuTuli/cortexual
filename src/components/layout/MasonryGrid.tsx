import { useMemo } from 'react'
import Masonry from 'react-masonry-css'
import { useAppStore } from '@/core/stores'
import type { Card as CardType } from '@/core/types'
import { Card } from '../cards/Card'
import type { ZoomLevel } from '@/core/stores/app-store'

const breakpointsByZoom: Record<ZoomLevel, Record<number | 'default', number>> = {
  1: { default: 6, 1536: 6, 1280: 5, 1024: 4, 768: 3, 640: 2 },
  2: { default: 5, 1536: 5, 1280: 4, 1024: 3, 768: 3, 640: 2 },
  3: { default: 4, 1536: 4, 1280: 3, 1024: 3, 768: 2, 640: 1 },
  4: { default: 3, 1536: 3, 1280: 3, 1024: 2, 768: 2, 640: 1 },
  5: { default: 3, 1536: 2, 1280: 2, 1024: 2, 768: 1, 640: 1 },
}

interface MasonryGridProps {
  cards: CardType[]
}

export function MasonryGrid({ cards }: MasonryGridProps) {
  const zoomLevel = useAppStore((s) => s.zoomLevel)
  const breakpointColumns = useMemo(() => breakpointsByZoom[zoomLevel], [zoomLevel])

  return (
    <Masonry
      breakpointCols={breakpointColumns}
      className="flex -ml-3 w-auto"
      columnClassName="pl-3 bg-clip-padding"
    >
      {cards.map((card) => (
        <div key={card.id} className="mb-3 min-w-0">
          <Card card={card} />
        </div>
      ))}
    </Masonry>
  )
}
