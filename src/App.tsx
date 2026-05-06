import { useEffect } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { useSpacesStore } from '@/core/stores/spaces-store'
import { useCardsStore } from '@/core/stores/cards-store'

function App() {
  const initializeSpaces = useSpacesStore((s) => s.initialize)
  const loadCards = useCardsStore((s) => s.loadCards)

  useEffect(() => {
    initializeSpaces()
    loadCards()
  }, [initializeSpaces, loadCards])

  return <AppShell />
}

export default App
