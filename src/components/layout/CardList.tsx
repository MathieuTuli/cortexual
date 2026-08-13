import type { Card } from '@/core/types'
import { CardRow } from '../cards/CardRow'

interface CardListProps {
  cards: Card[]
}

export function CardList({ cards }: CardListProps) {
  return (
    <div className="-mx-3">
      {cards.map((card) => (
        <CardRow key={card.id} card={card} />
      ))}
    </div>
  )
}
