import { useEffect } from 'react'
import { useAppStore, useCardsStore, useSpacesStore, useSearchStore } from '@/core/stores'
import { useViewMode } from '@/core/hooks'
import type { ViewMode } from '@/core/types'
import { Tag } from '../ui'
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
  {
    mode: 'canvas',
    label: 'Canvas',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="8" height="6" rx="1"/><rect x="14" y="7" width="7" height="10" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/></svg>,
  },
]

export function TopBar() {
  const openCreateModal = useAppStore((s) => s.openCreateModal)
  const searchQuery = useCardsStore((s) => s.searchQuery)
  const setSearchQuery = useCardsStore((s) => s.setSearchQuery)
  const filterTags = useCardsStore((s) => s.filterTags)
  const removeFilterTag = useCardsStore((s) => s.removeFilterTag)
  const clearFilters = useCardsStore((s) => s.clearFilters)
  const activeSpaceId = useSpacesStore((s) => s.activeSpaceId)
  const getSpaceById = useSpacesStore((s) => s.getSpaceById)

  const [viewMode, setViewMode] = useViewMode()
  const indexProgress = useSearchStore((s) => s.progress)

  const activeSpace = activeSpaceId ? getSpaceById(activeSpaceId) : null

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
    <div className="mb-6">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <svg
            className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          ><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input
            id="global-search"
            type="search"
            placeholder={activeSpace ? `Search in ${activeSpace.name}…` : 'Search your mind…'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/70 backdrop-blur-md border border-white/60 text-text rounded-full pl-11 pr-20 py-2.5 text-sm placeholder:text-text-muted focus:outline-none focus:bg-white focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/20 transition-colors"
          />
          {indexProgress ? (
            <span
              className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 text-[10px] tabular-nums text-text-muted bg-white/90 rounded border border-[var(--color-border)]"
              title="Building the search index"
            >
              indexing {Math.round((indexProgress.done / indexProgress.total) * 100)}%
            </span>
          ) : (
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[10px] font-medium text-text-muted bg-white/90 rounded border border-[var(--color-border)]">
              ⌘ K
            </kbd>
          )}
        </div>

        <div className="inline-flex p-1 rounded-full bg-white/70 backdrop-blur-md border border-white/60 flex-shrink-0">
          {VIEW_MODES.map(({ mode, label, icon }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              title={label}
              aria-label={label}
              aria-pressed={viewMode === mode}
              className={clsx(
                'w-8 h-8 rounded-full flex items-center justify-center transition-colors',
                viewMode === mode
                  ? 'bg-[#0f172a] text-white'
                  : 'text-text-muted hover:text-text'
              )}
            >
              {icon}
            </button>
          ))}
        </div>

        <button
          onClick={() => openCreateModal()}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-[#0f172a] text-white text-sm font-medium hover:bg-[#1e293b] transition-colors flex-shrink-0 shadow-soft"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
          Capture
        </button>
      </div>

      {filterTags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap mt-3">
          {filterTags.map((tag) => (
            <Tag key={tag} onRemove={() => removeFilterTag(tag)} active>
              {tag}
            </Tag>
          ))}
          <button
            onClick={clearFilters}
            className="text-xs text-text-muted hover:text-text transition-colors"
          >
            clear
          </button>
        </div>
      )}
    </div>
  )
}
