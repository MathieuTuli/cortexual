import type { HighlightCard } from '@/core/types'

const MAX = 400

export function CardHighlight({ card }: { card: HighlightCard }) {
  const text = card.text.length > MAX ? `${card.text.slice(0, MAX)}…` : card.text

  return (
    <div>
      <blockquote className="text-base text-text-body whitespace-pre-wrap break-words leading-relaxed">
        {text}
      </blockquote>

      {(card.author || card.siteName) && (
        <p className="mt-2.5 text-xs text-text-faint truncate">
          {card.author}
          {card.author && card.siteName && ' · '}
          {card.siteName}
        </p>
      )}

      {card.note && (
        <p className="mt-2.5 text-sm text-text-muted whitespace-pre-wrap break-words leading-relaxed">
          {card.note}
        </p>
      )}
    </div>
  )
}
