import { clsx } from 'clsx'
import { PageNav, StarButton } from '../ui'
import { go } from '@/core/router'

/**
 * Home plus the page switcher. One component rather than one per host, because
 * as two copies they drifted: the canvases page had the home button at 56px
 * against the shell's 36, so the cluster changed size as you moved between
 * pages. Hosts pass positioning; the contents are not theirs to vary.
 *
 * flex-wrap is a backstop for the shell, where this has to fit a 320px band —
 * if the labels ever outgrow it they drop to a second line instead of being cut.
 */
export function BarNav({ className }: { className?: string }) {
  return (
    <div className={clsx('flex flex-wrap items-center gap-1.5', className)}>
      <StarButton
        size="w-9 h-9"
        onClick={() => go({ name: 'home' })}
        title="Home"
        aria-label="Home"
        className="text-text-muted"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m3 10.5 9-7 9 7V20a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 20z" />
          <path d="M9.5 21.5v-7h5v7" />
        </svg>
      </StarButton>
      <PageNav />
    </div>
  )
}
