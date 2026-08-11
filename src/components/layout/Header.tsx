import { useEffect, useState } from 'react'
import { useAppStore, useCardsStore, useSpacesStore } from '@/core/stores'
import { Tag } from '../ui'

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'Working late.'
  if (h < 12) return 'Good morning.'
  if (h < 17) return 'Good afternoon.'
  if (h < 21) return 'Good evening.'
  return 'Good night.'
}

export function Header() {
  const openCreateModal = useAppStore((s) => s.openCreateModal)
  const searchQuery = useCardsStore((s) => s.searchQuery)
  const setSearchQuery = useCardsStore((s) => s.setSearchQuery)
  const filterTags = useCardsStore((s) => s.filterTags)
  const removeFilterTag = useCardsStore((s) => s.removeFilterTag)
  const clearFilters = useCardsStore((s) => s.clearFilters)
  const activeSpaceId = useSpacesStore((s) => s.activeSpaceId)
  const getSpaceById = useSpacesStore((s) => s.getSpaceById)

  const [greeting] = useState(getGreeting())
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
    <header className="hero-gradient relative">
      <div className="px-8 pt-6 pb-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-semibold text-white tracking-tight">
              {activeSpace ? `${activeSpace.icon ? activeSpace.icon + ' ' : ''}${activeSpace.name}` : greeting}
            </h1>
            <p className="text-sm text-white/70 mt-1">
              What are you exploring today?
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => openCreateModal()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white text-text text-sm font-medium hover:bg-white/95 transition-colors shadow-soft"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
              Capture
            </button>
            <button className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/15 text-white transition-colors" aria-label="Notifications">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/></svg>
            </button>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#a5b4fc] to-[#6366f1] border-2 border-white/30" />
          </div>
        </div>

        <div className="relative max-w-2xl">
          <svg
            className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted"
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          ><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input
            id="global-search"
            type="search"
            placeholder="Search your mind…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white text-text rounded-full pl-11 pr-20 py-3 text-sm placeholder:text-text-muted shadow-soft focus:outline-none focus:ring-2 focus:ring-white/40"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-1 text-[10px] font-medium text-text-muted bg-[#f3f4f6] rounded border border-[var(--color-border)]">
            ⌘ K
          </kbd>
        </div>

        {filterTags.length > 0 && (
          <div className="flex items-center gap-2 mt-4">
            {filterTags.map((tag) => (
              <Tag key={tag} onRemove={() => removeFilterTag(tag)} active>
                {tag}
              </Tag>
            ))}
            <button
              onClick={clearFilters}
              className="text-xs text-white/70 hover:text-white"
            >
              clear
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
