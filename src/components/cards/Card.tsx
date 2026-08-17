import type { Card as CardType } from '@/core/types'
import { cardSpaces } from '@/core/types'
import { useSpacesStore } from '@/core/stores'
import { CardNote } from './CardNote'
import { CardMedia } from './CardMedia'
import { CardLink } from './CardLink'
import { CardHighlight } from './CardHighlight'
import { useCardActions } from './use-card-actions'
import { timeAgo } from '@/core/utils'
import { clsx } from 'clsx'

interface CardProps {
  card: CardType
}

/** The kind of card, carried by the shape of its bottom-right corner. */
const CORNER: Record<CardType['type'], string> = {
  note: 'card-shaped card-shaped--sharp',
  image: 'card-shaped card-shaped--round',
  video: 'card-shaped card-shaped--slice',
  link: 'card-shaped card-shaped--cut',
  highlight: 'card-shaped card-shaped--wide',
}

export function Card({ card }: CardProps) {
  const spaces = useSpacesStore((s) => s.spaces)
  const { isSelected, onClick, onMenu, menus } = useCardActions(card)

  const memberSpaces = cardSpaces(card, spaces)
  const space = memberSpaces[0]
  const extraSpaces = memberSpaces.length - 1

  const isMediaTop = card.type === 'image' || card.type === 'video' || card.type === 'link'
  const titleText = card.type === 'link' ? card.title || card.preview?.title : card.title

  return (
    <>
      <article
        data-card-id={card.id}
        onClick={onClick}
        onContextMenu={onMenu}
        className={clsx(
          'card-surface group relative overflow-hidden cursor-pointer select-none',
          'w-full max-w-full min-w-0 bg-card transition-colors duration-150',
          // Inset: a clip-path or mask cuts to the border box, and an outset
          // ring is drawn beyond it, so on a shaped card it would vanish
          // entirely rather than just at the corner.
          isSelected ? 'ring-2 ring-inset ring-accent' : 'hover:bg-sunken',
          CORNER[card.type]
        )}
      >
        {isSelected && (
          <div className="absolute top-2.5 left-2.5 z-20 w-5 h-5 rounded-full bg-accent text-white flex items-center justify-center text-[11px] font-bold">
            ✓
          </div>
        )}

        {isMediaTop &&
          (card.type === 'link' ? <CardLink card={card} /> : <CardMedia card={card} />)}

        <div className="px-4 pt-3.5 pb-3">
          {card.type === 'note' && <CardNote card={card} />}
          {card.type === 'highlight' && <CardHighlight card={card} />}

          {isMediaTop && titleText && (
            <p className="text-base text-text leading-snug line-clamp-3">{titleText}</p>
          )}

          <div className="card-foot flex items-center justify-between gap-2 mt-3">
            <div className="flex items-center gap-1.5 min-w-0">
              {space && (
                <>
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: space.color || 'var(--text-faint)' }}
                  />
                  <span className="text-xs text-text-faint truncate">
                    {space.name}
                    {extraSpaces > 0 && ` +${extraSpaces}`}
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="text-xs text-text-faint tabular-nums">
                {timeAgo(card.createdAt)}
              </span>
              <button
                onClick={onMenu}
                className="w-6 h-6 ml-0.5 flex items-center justify-center rounded-full text-text-faint opacity-0 group-hover:opacity-100 hover:bg-bg/60 hover:text-text transition-all"
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
