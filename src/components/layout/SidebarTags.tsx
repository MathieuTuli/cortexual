import { useMemo } from 'react'
import { useCardsStore, useSpacesStore } from '@/core/stores'
import { cardIsInSpace, libraryCards } from '@/core/types'
import { clsx } from 'clsx'

const MAX_TAGS = 12

/**
 * Tag filters for whatever is on screen, counted against the active space so
 * the list narrows as you do. Lives in the one navigation column rather than a
 * second rail — the reference has no right-hand chrome, and a lone filter panel
 * opposite the sidebar was the last thing boxing the grid in.
 */
export function SidebarTags() {
  const cards = useCardsStore((s) => s.cards)
  const filterTags = useCardsStore((s) => s.filterTags)
  const addFilterTag = useCardsStore((s) => s.addFilterTag)
  const removeFilterTag = useCardsStore((s) => s.removeFilterTag)
  const activeSpaceId = useSpacesStore((s) => s.activeSpaceId)

  const tagCounts = useMemo(() => {
    const listed = libraryCards(cards)
    const scoped = activeSpaceId
      ? listed.filter((c) => cardIsInSpace(c, activeSpaceId))
      : listed
    const counts = new Map<string, number>()
    for (const card of scoped) {
      for (const tag of card.tags) counts.set(tag, (counts.get(tag) || 0) + 1)
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_TAGS)
  }, [cards, activeSpaceId])

  if (tagCounts.length === 0) return null

  const toggle = (tag: string) =>
    filterTags.includes(tag) ? removeFilterTag(tag) : addFilterTag(tag)

  return (
    <section>
      <p className="section-label mb-2.5 px-3">Tags</p>
      <div className="flex flex-wrap gap-1.5 px-3">
        {tagCounts.map(([tag, count]) => {
          const active = filterTags.includes(tag)
          return (
            <button
              key={tag}
              onClick={() => toggle(tag)}
              title={`${count} card${count === 1 ? '' : 's'}`}
              className={clsx(
                'h-7 px-3 inline-flex items-center rounded-full text-xs transition-colors',
                active ? 'bg-accent text-white' : 'bg-chip text-text-body hover:bg-sunken'
              )}
            >
              {tag}
            </button>
          )
        })}
      </div>
    </section>
  )
}
