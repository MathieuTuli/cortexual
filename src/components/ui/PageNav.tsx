import type { CSSProperties } from 'react'
import { clsx } from 'clsx'
import { go, useRoute, type Route } from '@/core/router'
import { Marquee } from './Marquee'

const PAGES: { label: string; name: Route['name']; route: Route }[] = [
  { label: 'Spaces', name: 'library', route: { name: 'library', spaceId: null } },
  { label: 'Projects', name: 'projects', route: { name: 'projects', projectId: null } },
  { label: 'Canvases', name: 'canvases', route: { name: 'canvases' } },
]

const REST: CSSProperties = {
  '--pill-bg': 'var(--text)',
  '--pill-bg-hover': 'var(--text)',
  '--pill-fg': 'var(--white)',
} as CSSProperties

const HERE: CSSProperties = {
  '--pill-bg': 'var(--accent)',
  '--pill-bg-hover': 'var(--accent-hover)',
  '--pill-fg': 'var(--white)',
} as CSSProperties

/**
 * Jump straight between the three destinations. Without it every move between
 * them is a trip out to the home page and back in.
 */
export function PageNav({ className }: { className?: string }) {
  const route = useRoute()

  return (
    <nav aria-label="Pages" className={clsx('flex items-center gap-1.5', className)}>
      {PAGES.map(({ label, name, route: target }) => (
        <button
          key={label}
          onClick={() => go(target)}
          aria-current={route.name === name ? 'page' : undefined}
          style={route.name === name ? HERE : REST}
          className="pill pill--nav pill--tight"
        >
          <Marquee text={label} />
        </button>
      ))}
    </nav>
  )
}
