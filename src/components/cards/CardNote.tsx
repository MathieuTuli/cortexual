import type { NoteCard } from '@/core/types'

interface CardNoteProps {
  card: NoteCard
}

export function CardNote({ card }: CardNoteProps) {
  const content = card.content.length > 300
    ? card.content.slice(0, 300) + '...'
    : card.content

  return (
    <div className="text-sm whitespace-pre-wrap break-words text-text">
      {content}
    </div>
  )
}
