import type { NoteCard } from '@/core/types'

interface CardNoteProps {
  card: NoteCard
}

export function CardNote({ card }: CardNoteProps) {
  const content = card.content.length > 280
    ? card.content.slice(0, 280) + '…'
    : card.content

  return (
    <p className="text-sm text-text whitespace-pre-wrap break-words leading-relaxed">
      {content}
    </p>
  )
}
