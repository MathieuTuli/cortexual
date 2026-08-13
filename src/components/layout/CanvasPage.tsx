import { useEffect, useState } from 'react'
import { useCardsStore, useLayoutStore, useProjectsStore, useSpacesStore } from '@/core/stores'
import { CanvasView } from './CanvasView'

/**
 * The canvas as its own page, opened in a new tab from the library. It loads
 * its own data because it's a fresh document, not a route inside the app —
 * which is also what makes it printable without the shell in the way.
 */
export function CanvasPage({ projectId }: { projectId: string }) {
  const loadCards = useCardsStore((s) => s.loadCards)
  const loadLayouts = useLayoutStore((s) => s.loadLayouts)
  const initializeSpaces = useSpacesStore((s) => s.initialize)
  const loadProjects = useProjectsStore((s) => s.loadProjects)
  const flushLayouts = useLayoutStore((s) => s.flush)

  const isLoading = useCardsStore((s) => s.isLoading)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    Promise.all([initializeSpaces(), loadProjects(), loadCards(), loadLayouts()]).then(() =>
      setReady(true)
    )
  }, [initializeSpaces, loadProjects, loadCards, loadLayouts])

  useEffect(() => {
    const onHide = () => void flushLayouts()
    window.addEventListener('pagehide', onHide)
    return () => window.removeEventListener('pagehide', onHide)
  }, [flushLayouts])

  if (!ready || isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="text-sm text-text-faint animate-pulse">Loading canvas…</p>
      </div>
    )
  }

  return <CanvasView projectId={projectId} />
}
