import { useSpacesStore, useCardsStore } from '@/core/stores'
import { SpaceList } from '../spaces/SpaceList'
import { ImportExport } from '../ImportExport'
import { clsx } from 'clsx'

export function Sidebar() {
  const activeSpaceId = useSpacesStore((s) => s.activeSpaceId)
  const setActiveSpace = useSpacesStore((s) => s.setActiveSpace)
  const cards = useCardsStore((s) => s.cards)
  const filterTags = useCardsStore((s) => s.filterTags)
  const clearFilters = useCardsStore((s) => s.clearFilters)

  const isAllCards = activeSpaceId === null && filterTags.length === 0
  const totalCount = cards.length

  return (
    <aside className="w-60 flex flex-col flex-shrink-0">
      <div className="px-6 pt-6 pb-5">
        <h1 className="text-xl font-semibold tracking-tight text-text">cortexual</h1>
      </div>

      <div className="px-3">
        <button
          onClick={() => {
            setActiveSpace(null)
            clearFilters()
          }}
          className={clsx(
            'w-full flex items-center justify-between gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-colors',
            isAllCards
              ? 'bg-white/70 backdrop-blur-sm text-text font-medium shadow-soft'
              : 'text-text-muted hover:bg-white/50 hover:text-text'
          )}
        >
          <span className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full flex-shrink-0 bg-[#94a3b8]" />
            All cards
          </span>
          <span className="text-[11px] tabular-nums text-text-muted">{totalCount}</span>
        </button>
      </div>

      <div className="mt-4 flex-1 overflow-y-auto">
        <SpaceList />
      </div>

      <ImportExport />
    </aside>
  )
}
