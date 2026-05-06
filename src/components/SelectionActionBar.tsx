import { useAppStore, useCardsStore, useSpacesStore } from '@/core/stores'
import { Button } from './ui'
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
      <div className="bg-gradient-to-b from-[#0066cc] to-[#004499] rounded-lg shadow-lg border-2 border-[#66ccff] px-4 py-3 flex items-center gap-4">
        <span className="text-white font-medium">
          {selectedCount} card{selectedCount !== 1 ? 's' : ''} selected
        </span>

        <div className="relative">
          <Button
            variant="default"
            size="sm"
            onClick={() => setShowSpaceDropdown(!showSpaceDropdown)}
          >
            Move to Space
          </Button>

          {showSpaceDropdown && (
            <div className="absolute bottom-full mb-2 left-0 bg-white rounded-lg shadow-lg border-2 border-[#a8d4f0] py-1 min-w-[180px]">
              {spaces.map((space) => (
                <button
                  key={space.id}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-[#e8f4fc] transition-colors flex items-center gap-2"
                  onClick={() => handleMoveToSpace(space.id)}
                >
                  <span>{space.icon || '📁'}</span>
                  <span>{space.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={clearSelection}
          className="text-white hover:text-[#b8e0ff]"
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}
