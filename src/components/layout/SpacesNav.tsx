import { useCardsStore, useSpacesStore } from '@/core/stores'
import { go } from '@/core/router'
import { libraryCards } from '@/core/types'
import { SpaceList } from '../spaces/SpaceList'
import { SidebarTags } from './SidebarTags'
import { SidebarTypes } from './SidebarTypes'
import { NavRow } from '../ui'

export function SpacesNav() {
  const activeSpaceId = useSpacesStore((s) => s.activeSpaceId)
  const cards = useCardsStore((s) => s.cards)
  const filterTags = useCardsStore((s) => s.filterTags)
  const filterTypes = useCardsStore((s) => s.filterTypes)
  const clearFilters = useCardsStore((s) => s.clearFilters)

  return (
    <>
      <NavRow
        label="All cards"
        trailing={libraryCards(cards).length}
        active={activeSpaceId === null && filterTags.length === 0 && filterTypes.length === 0}
        onClick={() => {
          clearFilters()
          go({ name: 'library', spaceId: null })
        }}
      />

      <SpaceList />
      <SidebarTypes />
      <SidebarTags />
    </>
  )
}
