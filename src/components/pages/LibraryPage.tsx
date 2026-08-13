import { useEffect } from 'react'
import { useSpacesStore } from '@/core/stores'
import { AppShell } from '../layout/AppShell'
import { SpacesNav } from '../layout/SpacesNav'
import { CardsView } from '../layout/CardsView'

export function LibraryPage({ spaceId }: { spaceId: string | null }) {
  const setActiveSpace = useSpacesStore((s) => s.setActiveSpace)
  const getSpaceById = useSpacesStore((s) => s.getSpaceById)

  // The route is the source of truth; the store follows it so that everything
  // reading activeSpaceId stays right after a back button or a fresh load.
  useEffect(() => {
    setActiveSpace(spaceId)
  }, [spaceId, setActiveSpace])

  const space = spaceId ? getSpaceById(spaceId) : null

  return (
    <AppShell
      nav={<SpacesNav />}
      searchPlaceholder={space ? `Search ${space.name}` : 'Search your library'}
    >
      <CardsView />
    </AppShell>
  )
}
