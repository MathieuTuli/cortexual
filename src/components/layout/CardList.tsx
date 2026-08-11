import type { Card } from '@/core/types'
import { CardRow } from '../cards/CardRow'

interface CardListProps {
  cards: Card[]
}

export function CardList({ cards }: CardListProps) {
  return (
    <div className="rounded-2xl bg-white/70 backdrop-blur-sm shadow-card overflow-hidden divide-y divide-[var(--color-border)]">
      {cards.map((card) => (
        <CardRow key={card.id} card={card} />
      ))}
    </div>
  )
}
