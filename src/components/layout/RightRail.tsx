import { useMemo } from 'react'
import { useCardsStore, useSpacesStore } from '@/core/stores'
import type { LinkCard } from '@/core/types'
import { getFavicon, getHostname } from '@/core/utils'
import { clsx } from 'clsx'

const TAG_DOT_COLORS = ['#4c6fff', '#22c55e', '#f97316', '#a855f7', '#14b8a6', '#ec4899', '#eab308']

function RailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="section-label mb-3 px-1">{title}</p>
      {children}
    </section>
  )
}

export function RightRail() {
  const cards = useCardsStore((s) => s.cards)
  const filterTags = useCardsStore((s) => s.filterTags)
  const addFilterTag = useCardsStore((s) => s.addFilterTag)
  const removeFilterTag = useCardsStore((s) => s.removeFilterTag)
  const activeSpaceId = useSpacesStore((s) => s.activeSpaceId)

  const scopedCards = useMemo(
    () => (activeSpaceId ? cards.filter((c) => c.spaceId === activeSpaceId) : cards),
    [cards, activeSpaceId],
  )

  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const c of scopedCards) {
      for (const t of c.tags) counts.set(t, (counts.get(t) || 0) + 1)
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count], i) => ({
        tag,
        count,
        color: TAG_DOT_COLORS[i % TAG_DOT_COLORS.length],
      }))
  }, [scopedCards])

  const topLinks = useMemo(() => {
    const linkCards = scopedCards.filter((c): c is LinkCard => c.type === 'link')
    const seen = new Map<string, LinkCard>()
    for (const lc of linkCards) {
      const host = getHostname(lc.url)
      if (!seen.has(host)) seen.set(host, lc)
    }
    return Array.from(seen.values()).slice(0, 6)
  }, [scopedCards])

  const toggleTag = (tag: string) => {
    if (filterTags.includes(tag)) removeFilterTag(tag)
    else addFilterTag(tag)
  }

  if (tagCounts.length === 0 && topLinks.length === 0) return null

  return (
    <aside className="w-72 flex flex-col p-5 gap-7 overflow-y-auto flex-shrink-0">
      {tagCounts.length > 0 && (
        <RailSection title="Tags">
          <div className="flex flex-wrap gap-1.5">
            {tagCounts.map(({ tag, color, count }) => {
              const active = filterTags.includes(tag)
              return (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  title={`${count} card${count === 1 ? '' : 's'}`}
                  className={clsx(
                    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-colors backdrop-blur-sm',
                    active
                      ? 'bg-[#0f172a] text-white'
                      : 'bg-white/70 hover:bg-white text-text'
                  )}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: active ? '#fff' : color }}
                  />
                  <span>{tag}</span>
                </button>
              )
            })}
          </div>
        </RailSection>
      )}

      {topLinks.length > 0 && (
        <RailSection title="Links">
          <ul className="space-y-1">
            {topLinks.map((lc) => {
              const host = getHostname(lc.url)
              const subtitle = lc.preview?.title || lc.title || lc.preview?.description || ''
              return (
                <li key={lc.id}>
                  <a
                    href={lc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-white/60 transition-colors group"
                  >
                    <div className="w-7 h-7 rounded-md bg-white/80 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      <img
                        src={getFavicon(lc.url)}
                        alt=""
                        width={14}
                        height={14}
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-text truncate">{host}</p>
                      {subtitle && (
                        <p className="text-[11px] text-text-muted truncate">{subtitle}</p>
                      )}
                    </div>
                    <svg
                      width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                    ><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>
                  </a>
                </li>
              )
            })}
          </ul>
        </RailSection>
      )}
    </aside>
  )
}
