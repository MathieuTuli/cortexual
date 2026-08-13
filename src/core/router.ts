import { useEffect, useState } from 'react'

export type Route =
  | { name: 'home' }
  | { name: 'library'; spaceId: string | null }
  | { name: 'projects'; projectId: string | null }
  | { name: 'canvases' }
  | { name: 'canvas'; projectId: string }

/**
 * Five routes, no nested layouts, no loaders, one user. A router library would
 * be more code than the thing it routes.
 */
export function parseRoute(pathname: string, search: string): Route {
  const params = new URLSearchParams(search)
  const [, head, tail] = pathname.split('/')

  switch (head) {
    case 'canvas': {
      // A canvas belongs to a project. /canvas on its own addresses nothing.
      const project = params.get('project')
      return project ? { name: 'canvas', projectId: project } : { name: 'home' }
    }
    case 'canvases':
      return { name: 'canvases' }
    case 'projects':
      return { name: 'projects', projectId: tail ? decodeURIComponent(tail) : null }
    case 'library':
      return { name: 'library', spaceId: tail ? decodeURIComponent(tail) : null }
    default:
      return { name: 'home' }
  }
}

export function hrefFor(route: Route): string {
  switch (route.name) {
    case 'home':
      return '/'
    case 'library':
      return route.spaceId ? `/library/${encodeURIComponent(route.spaceId)}` : '/library'
    case 'projects':
      return route.projectId ? `/projects/${encodeURIComponent(route.projectId)}` : '/projects'
    case 'canvases':
      return '/canvases'
    case 'canvas':
      return `/canvas?project=${encodeURIComponent(route.projectId)}`
  }
}

/** pushState doesn't fire popstate, so say so ourselves and let useRoute hear it. */
export function navigate(path: string) {
  if (path === window.location.pathname + window.location.search) return
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function go(route: Route) {
  navigate(hrefFor(route))
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() =>
    parseRoute(window.location.pathname, window.location.search)
  )

  useEffect(() => {
    const sync = () => setRoute(parseRoute(window.location.pathname, window.location.search))
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])

  return route
}
