import { useEffect, useState } from 'react'
import { useCardsStore, useLayoutStore, useProjectsStore, useSpacesStore } from '@/core/stores'
import { go } from '@/core/router'
import type { Route } from '@/core/router'
import { DEFAULT_SPACE_ID, libraryCards } from '@/core/types'
import { Button } from '../ui'

interface Destination {
  label: string
  count: number
  route: Route
}

export function HomePage() {
  const cards = useCardsStore((s) => s.cards)
  const setSearchQuery = useCardsStore((s) => s.setSearchQuery)
  const spaces = useSpacesStore((s) => s.spaces)
  const projects = useProjectsStore((s) => s.projects)
  const layouts = useLayoutStore((s) => s.layouts)
  const [query, setQuery] = useState('')

  useEffect(() => {
    document.getElementById('home-search')?.focus()
  }, [])

  const destinations: Destination[] = [
    {
      label: 'Spaces',
      count: spaces.filter((s) => s.id !== DEFAULT_SPACE_ID).length,
      route: { name: 'library', spaceId: null },
    },
    {
      label: 'Projects',
      count: projects.filter((p) => p.status === 'active').length,
      route: { name: 'projects', projectId: null },
    },
    {
      // Canvases that exist, not projects that could have one.
      label: 'Canvases',
      count: Object.values(layouts).filter((l) => Object.keys(l).length > 0).length,
      route: { name: 'canvases' },
    },
  ]

  // Searching from home is a search of everything, so it lands in the library.
  const search = (e: React.FormEvent) => {
    e.preventDefault()
    setSearchQuery(query)
    go({ name: 'library', spaceId: null })
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-8 pb-24">
      <h1 className="font-display text-hero text-text mb-10">cortexual</h1>

      <form onSubmit={search} className="w-full max-w-[600px]">
        <div className="relative">
          <svg
            className="absolute left-7 top-1/2 -translate-y-1/2 text-text-faint pointer-events-none"
            width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          ><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input
            id="home-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your library"
            className="w-full h-16 rounded-full bg-chip pl-[68px] pr-7 text-[19px] text-text placeholder:text-text-faint border-0 focus:outline-none focus:bg-sunken focus:ring-2 focus:ring-accent/25 transition-colors"
          />
        </div>
      </form>

      <div className="flex flex-wrap items-center justify-center gap-4 mt-16">
        {destinations.map(({ label, count, route }) => (
          <div key={label} className="flex items-baseline gap-2">
            <Button size="lg" onClick={() => go(route)}>
              {label}
            </Button>
            <span className="text-sm tabular-nums text-text-faint">{count}</span>
          </div>
        ))}
      </div>

      <p className="mt-16 text-sm text-text-faint tabular-nums">{libraryCards(cards).length} cards</p>
    </div>
  )
}
