import { useEffect } from 'react'
import { useCardsStore, useSearchStore } from '@/core/stores'
import { useViewMode, useScrolledPast } from '@/core/hooks'
import type { ViewMode } from '@/core/types'
import { CARD_TYPE_LABELS } from '@/core/types'
import { Tag, StarButton } from '../ui'
import { BarNav } from './BarNav'
import { clsx } from 'clsx'

const VIEW_MODES: { mode: ViewMode; label: string; icon: JSX.Element }[] = [
  {
    mode: 'grid',
    label: 'Grid view',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>,
  },
  {
    mode: 'list',
    label: 'List view',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></svg>,
  },
]

/**
 * Roughly the height of one row of cards: far enough that the tongue is a
 * response to reading rather than to a stray flick of the wheel.
 */
const TONGUE_AT = 140

/** Translucent so the grid shows through as it scrolls under, as in the reference. */
const FLOATING = 'bg-chip/80 backdrop-blur-xl'

export function TopBar({ placeholder }: { placeholder: string }) {
  const tongue = useScrolledPast(TONGUE_AT)
  const searchQuery = useCardsStore((s) => s.searchQuery)
  const setSearchQuery = useCardsStore((s) => s.setSearchQuery)
  const filterTags = useCardsStore((s) => s.filterTags)
  const removeFilterTag = useCardsStore((s) => s.removeFilterTag)
  const filterTypes = useCardsStore((s) => s.filterTypes)
  const toggleFilterType = useCardsStore((s) => s.toggleFilterType)
  const clearFilters = useCardsStore((s) => s.clearFilters)
  const [viewMode, setViewMode] = useViewMode()
  const indexProgress = useSearchStore((s) => s.progress)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        document.getElementById('global-search')?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="fixed top-0 left-0 right-[var(--scroll-lock,0px)] z-30 pointer-events-none">
      <div className="tongue" data-shown={tongue} aria-hidden />
      {/*
        Siblings in one row, not an overlay beside a margin. The band is the
        sidebar's width, so the search still lines up with the grid below it,
        and because the two are laid out against each other rather than
        positioned independently, neither can land on top of the other however
        wide the labels turn out to be. flex-wrap is the backstop: if the pills
        ever outgrow the band they drop to a second line instead of being cut.
      */}
      <div className="relative flex items-start pt-3.5 pb-3.5">
        {/*
          pt-1.5 puts the 36px cluster's centreline on the 48px search
          field's, which items-center cannot do here — the right column grows a
          second row when tag filters are on, and centring against that would
          drag the nav down with it.
        */}
        <BarNav className="w-80 flex-shrink-0 pl-5 pr-3 pt-1.5 pointer-events-auto" />

        <div className="flex-1 min-w-0 mx-auto max-w-[1280px] px-10">
        <div className="flex items-center gap-2.5 pointer-events-auto">
          <div className="relative flex-1">
            <svg
              className="absolute left-5 top-1/2 -translate-y-1/2 text-text-faint pointer-events-none"
              width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            ><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input
              id="global-search"
              type="search"
              placeholder={placeholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={clsx(
                // Matched to the icon buttons beside it, so the row reads as one bar.
                'w-full h-12 rounded-full pl-14 pr-24 text-[16px]',
                'text-text placeholder:text-text-faint border-0',
                'focus:outline-none focus:ring-2 focus:ring-accent/25',
                FLOATING
              )}
            />
            {indexProgress ? (
              <span
                className="absolute right-4 top-1/2 -translate-y-1/2 text-xs tabular-nums text-text-faint"
                title="Building the search index"
              >
                indexing {Math.round((indexProgress.done / indexProgress.total) * 100)}%
              </span>
            ) : (
              <kbd className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-text-faint">
                ⌘K
              </kbd>
            )}
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {VIEW_MODES.map(({ mode, label, icon }) => (
              <StarButton
                key={mode}
                size="w-12 h-12"
                onClick={() => setViewMode(mode)}
                title={label}
                aria-label={label}
                aria-pressed={viewMode === mode}
                className={
                  viewMode === mode ? 'text-white' : 'text-text-faint hover:text-text'
                }
                style={
                  viewMode === mode
                    ? ({ '--star-bg': 'var(--accent)', '--star-bg-hover': 'var(--accent-hover)' } as React.CSSProperties)
                    : ({ '--star-bg': 'rgb(242 242 242 / 0.8)' } as React.CSSProperties)
                }
              >
                {icon}
              </StarButton>
            ))}
          </div>

        </div>

        {(filterTags.length > 0 || filterTypes.length > 0) && (
          <div className="flex items-center gap-2 flex-wrap mt-2.5 pointer-events-auto">
            {filterTypes.map((type) => (
              <Tag key={type} onRemove={() => toggleFilterType(type)} active>
                {CARD_TYPE_LABELS[type]}
              </Tag>
            ))}
            {filterTags.map((tag) => (
              <Tag key={tag} onRemove={() => removeFilterTag(tag)} active>
                {tag}
              </Tag>
            ))}
            <button
              onClick={clearFilters}
              className="text-xs text-text-faint hover:text-text transition-colors"
            >
              clear
            </button>
          </div>
        )}
        </div>
      </div>
    </div>
  )
}
