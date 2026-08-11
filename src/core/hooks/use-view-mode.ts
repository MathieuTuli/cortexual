import { useAppStore, useSpacesStore } from '../stores'
import type { ViewMode } from '../types'

/** View mode of whatever is on screen — a space's own setting, or "All cards". */
export function useViewMode(): [ViewMode, (mode: ViewMode) => void] {
  const activeSpaceId = useSpacesStore((s) => s.activeSpaceId)
  const spaces = useSpacesStore((s) => s.spaces)
  const updateSpace = useSpacesStore((s) => s.updateSpace)
  const allCardsViewMode = useAppStore((s) => s.allCardsViewMode)
  const setAllCardsViewMode = useAppStore((s) => s.setAllCardsViewMode)

  const activeSpace = activeSpaceId ? spaces.find((s) => s.id === activeSpaceId) : undefined
  const viewMode = activeSpaceId ? activeSpace?.viewMode ?? 'grid' : allCardsViewMode

  const setViewMode = (mode: ViewMode) => {
    if (activeSpaceId) void updateSpace(activeSpaceId, { viewMode: mode })
    else setAllCardsViewMode(mode)
  }

  return [viewMode, setViewMode]
}
