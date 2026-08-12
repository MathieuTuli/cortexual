import { useEffect } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { CanvasPage } from '@/components/layout/CanvasPage'
import { useSpacesStore } from '@/core/stores/spaces-store'
import { useCardsStore } from '@/core/stores/cards-store'
import { useLayoutStore } from '@/core/stores/layout-store'
import { useSemanticSearch } from '@/core/hooks'

/**
 * The canvas is a separate document rather than a route, so it can be printed
 * without the app shell and opened in its own tab. Checked before any of the
 * library's own bootstrapping runs — CanvasPage does its own.
 */
function canvasSpaceId(): string | null | false {
  if (window.location.pathname !== '/canvas') return false
  return new URLSearchParams(window.location.search).get('space')
}

function App() {
  const spaceId = canvasSpaceId()
  if (spaceId !== false) return <CanvasPage spaceId={spaceId} />
  return <Library />
}

function Library() {
  const initializeSpaces = useSpacesStore((s) => s.initialize)
  const loadCards = useCardsStore((s) => s.loadCards)
  const loadLayouts = useLayoutStore((s) => s.loadLayouts)
  const flushLayouts = useLayoutStore((s) => s.flush)

  useSemanticSearch()

  useEffect(() => {
    initializeSpaces()
    loadCards()
    loadLayouts()
  }, [initializeSpaces, loadCards, loadLayouts])

  // Canvas drags are buffered for 400ms before hitting disk; without this the
  // last move before a reload is lost.
  useEffect(() => {
    const onHide = () => void flushLayouts()
    window.addEventListener('pagehide', onHide)
    return () => window.removeEventListener('pagehide', onHide)
  }, [flushLayouts])

  return <AppShell />
}

export default App
