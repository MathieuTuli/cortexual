import { useMemo } from 'react'
import { useCardsStore, useSpacesStore } from '@/core/stores'
import { CARD_TYPE_LABELS, CardTypeEnum, cardIsInSpace, libraryCards } from '@/core/types'
import type { CardType } from '@/core/types'
import { clsx } from 'clsx'

/**
 * Media-type filters, counted against the active space like the tag pills
 * below them. Hidden when everything on screen is one type — a lone pill
 * could only narrow the list to itself.
 */
export function SidebarTypes() {
  const cards = useCardsStore((s) => s.cards)
  const filterTypes = useCardsStore((s) => s.filterTypes)
  const toggleFilterType = useCardsStore((s) => s.toggleFilterType)
  const activeSpaceId = useSpacesStore((s) => s.activeSpaceId)

  const typeCounts = useMemo(() => {
    const listed = libraryCards(cards)
    const scoped = activeSpaceId
      ? listed.filter((c) => cardIsInSpace(c, activeSpaceId))
      : listed
    const counts = new Map<CardType, number>()
    for (const card of scoped) {
      counts.set(card.type, (counts.get(card.type) || 0) + 1)
    }
    return CardTypeEnum.options
      .filter((type) => counts.has(type))
      .map((type) => [type, counts.get(type)!] as const)
  }, [cards, activeSpaceId])

  if (typeCounts.length < 2) return null

  return (
    <section>
      <p className="section-label mb-2.5 px-3">Types</p>
      <div className="flex flex-wrap gap-1.5 px-3">
        {typeCounts.map(([type, count]) => {
          const active = filterTypes.includes(type)
          return (
            <button
              key={type}
              onClick={() => toggleFilterType(type)}
              title={`${count} card${count === 1 ? '' : 's'}`}
              className={clsx(
                'h-7 px-3 inline-flex items-center rounded-full text-xs transition-colors',
                active ? 'bg-accent text-white' : 'bg-chip text-text-body hover:bg-sunken'
              )}
            >
              {CARD_TYPE_LABELS[type]}
            </button>
          )
        })}
      </div>
    </section>
  )
}
