import type { PdfCard } from '@/core/types'

export function CardPdf({ card }: { card: PdfCard }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-md bg-chip flex items-center justify-center text-base flex-shrink-0">
          📄
        </div>
        <div className="min-w-0">
          <p className="text-base text-text leading-snug truncate">
            {card.title || card.fileName}
          </p>
          {card.pageCount !== undefined && (
            <p className="text-xs text-text-faint">
              {card.pageCount} page{card.pageCount === 1 ? '' : 's'}
            </p>
          )}
        </div>
      </div>
      {card.extractedText && (
        <p className="text-sm text-text-muted leading-relaxed line-clamp-4">
          {card.extractedText}
        </p>
      )}
    </div>
  )
}
