import { useAppStore, useCardsStore, useSpacesStore } from '@/core/stores'
import { useState } from 'react'

export function SelectionActionBar() {
  const selectedCardIds = useAppStore((s) => s.selectedCardIds)
  const clearSelection = useAppStore((s) => s.clearSelection)
  const moveCardsToSpace = useCardsStore((s) => s.moveCardsToSpace)
  const spaces = useSpacesStore((s) => s.spaces)

  const [showSpaceDropdown, setShowSpaceDropdown] = useState(false)

  const selectedCount = selectedCardIds.size

  if (selectedCount === 0) return null

  const handleMoveToSpace = async (spaceId: string) => {
    await moveCardsToSpace(Array.from(selectedCardIds), spaceId)
    clearSelection()
    setShowSpaceDropdown(false)
  }

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="bg-[#0f172a] text-white rounded-full shadow-card px-5 py-2 flex items-center gap-3">
        <span className="text-sm font-medium">
          {selectedCount} card{selectedCount !== 1 ? 's' : ''} selected
        </span>

        <span className="w-px h-5 bg-white/20" />

        <div className="relative">
          <button
            onClick={() => setShowSpaceDropdown(!showSpaceDropdown)}
            className="text-sm text-white/80 hover:text-white transition-colors"
          >
            Move to space
          </button>

          {showSpaceDropdown && (
            <div className="absolute bottom-full mb-2 left-0 bg-white text-text rounded-xl shadow-card border border-[var(--color-border)] py-1 min-w-[180px]">
              {spaces.map((space) => (
                <button
                  key={space.id}
                  className="w-full px-3 py-1.5 text-left text-sm hover:bg-[#f3f4f6] transition-colors flex items-center gap-2"
                  onClick={() => handleMoveToSpace(space.id)}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: space.color || '#94a3b8' }}
                  />
                  <span>{space.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <span className="w-px h-5 bg-white/20" />

        <button
          onClick={clearSelection}
          className="text-sm text-white/80 hover:text-white transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
