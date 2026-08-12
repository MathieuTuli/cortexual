import { useEffect, useState } from 'react'
import { useCardsStore, useLayoutStore, useSpacesStore } from '@/core/stores'
import { CanvasView } from './CanvasView'

/**
 * The canvas as its own page, opened in a new tab from the library. It loads
 * its own data because it's a fresh document, not a route inside the app —
 * which is also what makes it printable without the shell in the way.
 */
export function CanvasPage({ spaceId }: { spaceId: string | null }) {
  const loadCards = useCardsStore((s) => s.loadCards)
  const loadLayouts = useLayoutStore((s) => s.loadLayouts)
  const initializeSpaces = useSpacesStore((s) => s.initialize)
  const flushLayouts = useLayoutStore((s) => s.flush)

  const isLoading = useCardsStore((s) => s.isLoading)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    Promise.all([initializeSpaces(), loadCards(), loadLayouts()]).then(() => setReady(true))
  }, [initializeSpaces, loadCards, loadLayouts])

  useEffect(() => {
    const onHide = () => void flushLayouts()
    window.addEventListener('pagehide', onHide)
    return () => window.removeEventListener('pagehide', onHide)
  }, [flushLayouts])

  if (!ready || isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="text-sm text-text-muted animate-pulse">Loading canvas…</p>
      </div>
    )
  }

  return <CanvasView spaceId={spaceId} />
}
