import { useEffect } from 'react'
import { useRoute, type Route } from '@/core/router'
import { CanvasPage } from '@/components/layout/CanvasPage'
import { HomePage, LibraryPage, ProjectsPage, CanvasesPage } from '@/components/pages'
import { useSpacesStore } from '@/core/stores/spaces-store'
import { useProjectsStore } from '@/core/stores/projects-store'
import { useCardsStore } from '@/core/stores/cards-store'
import { useLayoutStore } from '@/core/stores/layout-store'
import { useSemanticSearch } from '@/core/hooks'

function App() {
  const route = useRoute()

  /**
   * The canvas is a separate document rather than a page inside the library, so
   * it can be printed without the shell in the way and opened in its own tab.
   * Checked before any of the library's own bootstrapping runs — CanvasPage
   * does its own.
   */
  if (route.name === 'canvas') return <CanvasPage projectId={route.projectId} />

  return <Library route={route} />
}

function Library({ route }: { route: Route }) {
  const initializeSpaces = useSpacesStore((s) => s.initialize)
  const loadProjects = useProjectsStore((s) => s.loadProjects)
  const loadCards = useCardsStore((s) => s.loadCards)
  const loadLayouts = useLayoutStore((s) => s.loadLayouts)
  const flushLayouts = useLayoutStore((s) => s.flush)

  useSemanticSearch()

  useEffect(() => {
    initializeSpaces()
    loadProjects()
    loadCards()
    loadLayouts()
  }, [initializeSpaces, loadProjects, loadCards, loadLayouts])

  // Canvas drags are buffered for 400ms before hitting disk; without this the
  // last move before a reload is lost.
  useEffect(() => {
    const onHide = () => void flushLayouts()
    window.addEventListener('pagehide', onHide)
    return () => window.removeEventListener('pagehide', onHide)
  }, [flushLayouts])

  /**
   * A canvas is arranged in a tab of its own, so its layout is written by a
   * different document to the one showing the Canvases list. Loading layouts
   * once at boot meant a canvas you had just made stayed invisible here until a
   * manual reload — it was saved, just never re-read. Coming back to this tab is
   * the moment to look again.
   */
  useEffect(() => {
    const resync = () => {
      if (document.visibilityState !== 'visible') return
      void flushLayouts().then(loadLayouts)
    }
    document.addEventListener('visibilitychange', resync)
    window.addEventListener('focus', resync)
    return () => {
      document.removeEventListener('visibilitychange', resync)
      window.removeEventListener('focus', resync)
    }
  }, [flushLayouts, loadLayouts])

  switch (route.name) {
    case 'library':
      return <LibraryPage spaceId={route.spaceId} />
    case 'projects':
      return <ProjectsPage projectId={route.projectId} />
    case 'canvases':
      return <CanvasesPage />
    default:
      return <HomePage />
  }
}

export default App
