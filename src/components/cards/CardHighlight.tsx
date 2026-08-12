import type { HighlightCard } from '@/core/types'

const MAX = 400

export function CardHighlight({ card }: { card: HighlightCard }) {
  const text = card.text.length > MAX ? `${card.text.slice(0, MAX)}…` : card.text

  return (
    <div>
      <blockquote className="border-l-2 border-[var(--color-border-bold)] pl-3 text-sm text-text whitespace-pre-wrap break-words leading-relaxed">
        {text}
      </blockquote>

      {(card.author || card.siteName) && (
        <p className="mt-2 pl-3 text-[11px] text-text-muted truncate">
          {card.author}
          {card.author && card.siteName && ' · '}
          {card.siteName}
        </p>
      )}

      {card.note && (
        <p className="mt-2 text-xs text-text-muted whitespace-pre-wrap break-words leading-relaxed">
          {card.note}
        </p>
      )}
    </div>
  )
}
