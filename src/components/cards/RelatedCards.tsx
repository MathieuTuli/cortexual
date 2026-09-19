import { useMemo } from 'react'
import { useAppStore, useCardsStore, useSearchStore } from '@/core/stores'
import { useCardThumbnail } from '@/core/hooks'
import type { Card } from '@/core/types'
import { cardText } from '@/core/search/card-text'
import { clsx } from 'clsx'

const TYPE_GLYPH: Record<Card['type'], string> = {
  note: '📝',
  image: '🖼️',
  video: '🎬',
  link: '🔗',
  highlight: '❝',
  pdf: '📄',
}

function RelatedThumbnail({ card }: { card: Card }) {
  const thumbnail = useCardThumbnail(card)
  const shell = 'w-10 h-10 rounded-md flex-shrink-0 overflow-hidden flex items-center justify-center bg-chip'

  if (thumbnail) {
    return (
      <div className={shell}>
        <img src={thumbnail} alt="" loading="lazy" className="w-full h-full object-cover" />
      </div>
    )
  }
  return <div className={clsx(shell, 'text-sm')}>{TYPE_GLYPH[card.type]}</div>
}

function label(card: Card): string {
  if (card.title) return card.title
  if (card.type === 'link') return card.preview?.title || card.url
  const text = cardText(card).split('\n')[0]
  return text || 'Untitled'
}

export function RelatedCards({ cardId }: { cardId: string }) {
  const cards = useCardsStore((s) => s.cards)
  const openViewModal = useAppStore((s) => s.openViewModal)
  const relatedIds = useSearchStore((s) => s.relatedIds)
  const status = useSearchStore((s) => s.status)
  // relatedIds reads the vector map off the store, so subscribe to it directly
  // — otherwise this never re-renders when indexing finishes.
  const vectors = useSearchStore((s) => s.vectors)

  const related = useMemo(() => {
    if (!vectors.has(cardId)) return []
    return relatedIds(cardId, 5)
      .map(({ item, score }) => ({ card: cards.find((c) => c.id === item), score }))
      .filter((r): r is { card: Card; score: number } => Boolean(r.card))
  }, [cardId, cards, relatedIds, vectors])

  if (status === 'indexing') {
    return (
      <div className="pt-5">
        <p className="section-label mb-2.5">Related</p>
        <p className="text-sm text-text-faint">Still indexing…</p>
      </div>
    )
  }

  if (related.length === 0) return null

  return (
    <div className="pt-5">
      <p className="section-label mb-2.5">Related</p>
      <ul className="space-y-0.5">
        {related.map(({ card, score }) => (
          <li key={card.id}>
            <button
              onClick={() => openViewModal(card.id)}
              className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-chip transition-colors text-left group"
            >
              <RelatedThumbnail card={card} />
              <span className="flex-1 min-w-0">
                <span className="block text-sm text-text truncate">{label(card)}</span>
                {card.tags.length > 0 && (
                  <span className="block text-xs text-text-faint truncate">
                    {card.tags.slice(0, 3).join(' · ')}
                  </span>
                )}
              </span>
              <span className="text-xs tabular-nums text-text-faint opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                {Math.round(score * 100)}%
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
