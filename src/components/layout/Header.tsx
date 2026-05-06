import { useAppStore, useCardsStore, useSpacesStore } from '@/core/stores'
import { Button, Input, Tag } from '../ui'

export function Header() {
  const openCreateModal = useAppStore((s) => s.openCreateModal)
  const searchQuery = useCardsStore((s) => s.searchQuery)
  const setSearchQuery = useCardsStore((s) => s.setSearchQuery)
  const filterTags = useCardsStore((s) => s.filterTags)
  const removeFilterTag = useCardsStore((s) => s.removeFilterTag)
  const clearFilters = useCardsStore((s) => s.clearFilters)
  const activeSpaceId = useSpacesStore((s) => s.activeSpaceId)
  const getSpaceById = useSpacesStore((s) => s.getSpaceById)

  // Zoom controls
  const zoomLevel = useAppStore((s) => s.zoomLevel)
  const zoomIn = useAppStore((s) => s.zoomIn)
  const zoomOut = useAppStore((s) => s.zoomOut)

  const activeSpace = activeSpaceId ? getSpaceById(activeSpaceId) : null

  return (
    <header className="bg-gradient-to-b from-[#f8fcff] to-[#e8f4fc] border-b-2 border-[#a8d4f0] p-4 shadow-y2k">
      <div className="flex items-center gap-4">
        {/* Space Title */}
        <div className="flex-shrink-0">
          <h2 className="text-lg font-bold text-accent-primary">
            {activeSpace ? (
              <>
                {activeSpace.icon && <span className="mr-1">{activeSpace.icon}</span>}
                {activeSpace.name}
              </>
            ) : (
              '📚 All Cards'
            )}
          </h2>
        </div>

        {/* Search */}
        <div className="flex-1 max-w-md">
          <Input
            type="search"
            placeholder="🔍 Search cards..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Filter Tags */}
        {filterTags.length > 0 && (
          <div className="flex items-center gap-2">
            {filterTags.map((tag) => (
              <Tag key={tag} onRemove={() => removeFilterTag(tag)} active>
                {tag}
              </Tag>
            ))}
            <button
              onClick={clearFilters}
              className="text-xs text-text-muted hover:text-accent-primary"
            >
              clear
            </button>
          </div>
        )}

        {/* Zoom Controls */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={zoomOut}
            disabled={zoomLevel === 1}
            className="w-8 h-8 flex items-center justify-center rounded border-2 border-[#a8d4f0] bg-white hover:bg-[#e8f4fc] disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-accent-primary font-bold"
            title="Zoom out (smaller cards, more columns)"
          >
            −
          </button>
          <span className="w-6 text-center text-sm text-text-muted font-medium">{zoomLevel}</span>
          <button
            onClick={zoomIn}
            disabled={zoomLevel === 5}
            className="w-8 h-8 flex items-center justify-center rounded border-2 border-[#a8d4f0] bg-white hover:bg-[#e8f4fc] disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-accent-primary font-bold"
            title="Zoom in (larger cards, fewer columns)"
          >
            +
          </button>
        </div>

        {/* Create Button */}
        <Button
          variant="primary"
          onClick={() => openCreateModal()}
          className="flex-shrink-0"
        >
          ➕ New Card
        </Button>
      </div>
    </header>
  )
}
