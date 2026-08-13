import type { Card, LinkCard } from '@/core/types'
import { cardSpaces } from '@/core/types'
import { useSpacesStore } from '@/core/stores'
import { useCardThumbnail, useLinkPreview } from '@/core/hooks'
import { useCardActions } from './use-card-actions'
import { timeAgo } from '@/core/utils'
import { clsx } from 'clsx'

const TYPE_GLYPH: Record<Card['type'], string> = {
  note: '📝',
  image: '🖼️',
  video: '🎬',
  link: '🔗',
  highlight: '❝',
}

function RowThumbnail({ card }: { card: Card }) {
  const thumbnail = useCardThumbnail(card)
  const shell = 'w-10 h-10 rounded-md flex-shrink-0 overflow-hidden flex items-center justify-center bg-chip'

  if (card.type === 'link') {
    return <LinkFavicon card={card} className={shell} />
  }

  if (thumbnail) {
    const isPoster = thumbnail.startsWith('data:')
    return (
      <div className={shell}>
        {card.type === 'video' && !isPoster ? (
          <video src={`${thumbnail}#t=0.1`} preload="metadata" muted className="w-full h-full object-cover" />
        ) : (
          <img src={thumbnail} alt="" loading="lazy" className="w-full h-full object-cover" />
        )}
      </div>
    )
  }

  return <div className={clsx(shell, 'text-sm')}>{TYPE_GLYPH[card.type]}</div>
}

function LinkFavicon({ card, className }: { card: LinkCard; className: string }) {
  const { favicon } = useLinkPreview(card)
  return (
    <div className={className}>
      {favicon ? (
        <img
          src={favicon}
          alt=""
          width={16}
          height={16}
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
      ) : (
        <span className="text-sm">🔗</span>
      )}
    </div>
  )
}

function LinkRowTitle({ card }: { card: LinkCard }) {
  const { title, subtitle } = useLinkPreview(card)
  return (
    <>
      <a
        href={card.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="text-base text-text hover:text-accent hover:underline underline-offset-2 truncate block"
      >
        {title}
      </a>
      <p className="text-xs text-text-faint truncate">{subtitle}</p>
    </>
  )
}

function rowSummary(card: Exclude<Card, LinkCard>): { title: string; subtitle: string; untitled: boolean } {
  if (card.type === 'note') {
    const firstLine = card.content.trim().split('\n')[0]
    return { title: card.title || firstLine || 'Empty note', subtitle: card.title ? firstLine : '', untitled: !(card.title || firstLine) }
  }
  if (card.type === 'highlight') {
    const quote = card.text.trim().split('\n')[0]
    const attribution = [card.author, card.siteName].filter(Boolean).join(' · ')
    return {
      title: quote || card.title || 'Empty highlight',
      subtitle: attribution,
      untitled: !quote,
    }
  }
  const named = card.title || card.caption || card.autoCaption
  return {
    title: named || (card.type === 'image' ? 'Image' : 'Video'),
    subtitle: card.title ? card.caption || '' : '',
    untitled: !named,
  }
}

export function CardRow({ card }: { card: Card }) {
  const spaces = useSpacesStore((s) => s.spaces)
  const { isSelected, onClick, onMenu, menus } = useCardActions(card)

  const memberSpaces = cardSpaces(card, spaces)
  const space = memberSpaces[0]
  const extraSpaces = memberSpaces.length - 1
  const summary = card.type === 'link' ? null : rowSummary(card)

  return (
    <>
      <div
        data-card-id={card.id}
        onClick={onClick}
        onContextMenu={onMenu}
        className={clsx(
          'group flex items-center gap-3.5 h-16 px-3 rounded-lg cursor-pointer select-none transition-colors',
          isSelected ? 'bg-accent-soft' : 'hover:bg-chip'
        )}
      >
        {isSelected ? (
          <div className="w-10 h-10 rounded-md flex-shrink-0 bg-accent text-white flex items-center justify-center text-xs font-bold">
            ✓
          </div>
        ) : (
          <RowThumbnail card={card} />
        )}

        <div className="flex-1 min-w-0">
          {card.type === 'link' ? (
            <LinkRowTitle card={card} />
          ) : (
            <>
              <p
                className={clsx(
                  'text-base truncate',
                  summary!.untitled ? 'text-text-faint' : 'text-text'
                )}
              >
                {summary!.title}
              </p>
              {summary!.subtitle && (
                <p className="text-xs text-text-faint truncate">{summary!.subtitle}</p>
              )}
            </>
          )}
        </div>

        {card.tags.length > 0 && (
          <div className="hidden lg:flex items-center gap-1.5 flex-shrink-0 max-w-[260px] overflow-hidden">
            {card.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="h-6 px-2.5 inline-flex items-center rounded-full bg-chip text-xs text-text-muted whitespace-nowrap"
              >
                {tag}
              </span>
            ))}
            {card.tags.length > 3 && (
              <span className="text-xs text-text-faint">+{card.tags.length - 3}</span>
            )}
          </div>
        )}

        {space && (
          <span className="hidden md:inline-flex items-center gap-1.5 flex-shrink-0 text-xs text-text-faint max-w-[140px]">
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: space.color || 'var(--text-faint)' }}
            />
            <span className="truncate">
              {space.name}
              {extraSpaces > 0 && ` +${extraSpaces}`}
            </span>
          </span>
        )}

        <span className="text-xs text-text-faint tabular-nums flex-shrink-0 w-16 text-right">
          {timeAgo(card.createdAt)}
        </span>

        <button
          onClick={onMenu}
          className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-full text-text-faint opacity-0 group-hover:opacity-100 hover:bg-sunken hover:text-text transition-all"
          aria-label="More actions"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>
        </button>
      </div>

      {menus}
    </>
  )
}
