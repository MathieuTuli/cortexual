import { useEffect } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { useSpacesStore } from '@/core/stores/spaces-store'
import { useCardsStore } from '@/core/stores/cards-store'
import { useLayoutStore } from '@/core/stores/layout-store'
import { useSemanticSearch } from '@/core/hooks'

function App() {
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
