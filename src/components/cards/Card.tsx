import type { Card as CardType } from '@/core/types'
import { cardSpaces } from '@/core/types'
import { useSpacesStore } from '@/core/stores'
import { CardNote } from './CardNote'
import { CardMedia } from './CardMedia'
import { CardLink } from './CardLink'
import { useCardActions } from './use-card-actions'
import { timeAgo } from '@/core/utils'
import { clsx } from 'clsx'

interface CardProps {
  card: CardType
}

const TYPE_PILL: Record<string, { label: string; tone: 'dark' | 'light' }> = {
  note: { label: 'NOTE', tone: 'light' },
  image: { label: 'IMAGE', tone: 'dark' },
  video: { label: 'VIDEO', tone: 'dark' },
  link: { label: 'LINK', tone: 'dark' },
}

function TypePill({ type, extra }: { type: CardType['type']; extra?: string }) {
  const meta = TYPE_PILL[type]
  if (!meta) return null
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider',
        meta.tone === 'dark'
          ? 'bg-[#0f172a]/80 text-white backdrop-blur-sm'
          : 'bg-[#f3f4f6] text-text-muted'
      )}
    >
      {meta.label}
      {extra && <span className="opacity-80">{extra}</span>}
    </span>
  )
}

export function Card({ card }: CardProps) {
  const spaces = useSpacesStore((s) => s.spaces)
  const { isSelected, onClick, onMenu, menus } = useCardActions(card)

  const memberSpaces = cardSpaces(card, spaces)
  const space = memberSpaces[0]
  const extraSpaces = memberSpaces.length - 1

  const isMediaTop = card.type === 'image' || card.type === 'video' || card.type === 'link'

  return (
    <>
      <article
        data-card-id={card.id}
        onClick={onClick}
        onContextMenu={onMenu}
        className={clsx(
          'group relative bg-white rounded-2xl overflow-hidden cursor-pointer w-full max-w-full min-w-0',
          'transition-all duration-150',
          isSelected
            ? 'ring-2 ring-accent-primary shadow-card-hover'
            : 'shadow-card hover:shadow-card-hover hover:-translate-y-0.5',
          'select-none'
        )}
      >
        {isSelected && (
          <div className="absolute top-2 left-2 z-20 w-5 h-5 rounded-full bg-accent-primary text-white flex items-center justify-center text-[11px] font-bold shadow">
            ✓
          </div>
        )}

        {isMediaTop && (
          <div className="relative">
            {card.type === 'image' || card.type === 'video' ? (
              <CardMedia card={card} />
            ) : (
              <CardLink card={card} />
            )}
            <div className="absolute top-2.5 left-2.5 z-10">
              <TypePill type={card.type} />
            </div>
          </div>
        )}

        <div className={clsx('px-3.5', isMediaTop ? 'pt-3 pb-3' : 'pt-3.5 pb-3')}>
          {!isMediaTop && card.type === 'note' && (
            <div className="flex items-start justify-between mb-2 gap-2">
              {card.title && (
                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider truncate">
                  {card.title}
                </h3>
              )}
              <div className="ml-auto"><TypePill type="note" /></div>
            </div>
          )}

          {!isMediaTop && card.type === 'note' && <CardNote card={card} />}

          {isMediaTop && (() => {
            const titleText = card.type === 'link' ? (card.title || card.preview?.title) : card.title
            if (!titleText) return null
            return (
              <p className="text-sm font-medium text-text leading-snug line-clamp-2 mb-2">
                {titleText}
              </p>
            )
          })()}

          <div className="flex items-center justify-between gap-2 mt-2">
            <div className="flex items-center gap-1.5 min-w-0">
              {space && (
                <>
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: space.color || '#94a3b8' }}
                  />
                  <span className="text-[11px] text-text-muted truncate">
                    {space.name}
                    {extraSpaces > 0 && ` +${extraSpaces}`}
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="text-[11px] text-text-muted tabular-nums">
                {timeAgo(card.createdAt)}
              </span>
              <button
                onClick={onMenu}
                className="w-5 h-5 ml-1 flex items-center justify-center rounded text-text-muted opacity-0 group-hover:opacity-100 hover:bg-[#f3f4f6] transition-all"
                aria-label="More actions"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>
              </button>
            </div>
          </div>
        </div>
      </article>

      {menus}
    </>
  )
}
