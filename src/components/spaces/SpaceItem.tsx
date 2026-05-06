import { useState } from 'react'
import type { Space } from '@/core/types'
import { useSpacesStore, useCardsStore } from '@/core/stores'
import { clsx } from 'clsx'
import { ContextMenu, useContextMenu, type ContextMenuItem, Modal, Input, Button } from '../ui'

// Y2K-inspired color palette
const PRESET_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#0ea5e9', '#6366f1', '#a855f7', '#ec4899',
]

interface SpaceItemProps {
  space: Space
}

export function SpaceItem({ space }: SpaceItemProps) {
  const activeSpaceId = useSpacesStore((s) => s.activeSpaceId)
  const setActiveSpace = useSpacesStore((s) => s.setActiveSpace)
  const updateSpace = useSpacesStore((s) => s.updateSpace)
  const deleteSpace = useSpacesStore((s) => s.deleteSpace)
  const cards = useCardsStore((s) => s.cards)

  const { contextMenu, showContextMenu, hideContextMenu } = useContextMenu()
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(space.name)
  const [editColor, setEditColor] = useState(space.color || null)
  const [editIcon, setEditIcon] = useState(space.icon || '')

  const cardCount = cards.filter((c) => c.spaceId === space.id).length
  const isActive = activeSpaceId === space.id

  const handleContextMenu = (e: React.MouseEvent) => {
    if (space.isDefault) return // Don't show context menu for default space

    const items: ContextMenuItem[] = [
      {
        label: 'Edit Space',
        icon: '✏️',
        onClick: () => {
          setEditName(space.name)
          setEditColor(space.color || null)
          setEditIcon(space.icon || '')
          setIsEditing(true)
        },
      },
      { label: '', divider: true, onClick: () => {} },
      {
        label: 'Delete Space',
        icon: '🗑️',
        danger: true,
        onClick: () => {
          if (confirm(`Delete "${space.name}" and all ${cardCount} cards in it?`)) {
            deleteSpace(space.id)
            if (activeSpaceId === space.id) {
              setActiveSpace(null)
            }
          }
        },
      },
    ]
    showContextMenu(e, items)
  }

  const handleSaveEdit = async () => {
    await updateSpace(space.id, {
      name: editName.trim() || space.name,
      color: editColor || undefined,
      icon: editIcon || undefined,
    })
    setIsEditing(false)
  }

  return (
    <>
      <button
        className={clsx(
          'w-full px-4 py-2 flex items-center gap-2',
          'text-sm text-left rounded-r-lg mr-2',
          'transition-all',
          isActive
            ? 'bg-gradient-to-r from-[#e0f0ff] to-[#f0f8ff] border-l-4 text-accent-primary font-medium shadow-y2k-inset'
            : 'hover:bg-[#e8f4fc] text-text-muted hover:text-text border-l-4 border-transparent'
        )}
        style={isActive && space.color ? { borderLeftColor: space.color } : isActive ? { borderLeftColor: 'var(--accent-primary)' } : undefined}
        onClick={() => setActiveSpace(space.id)}
        onContextMenu={handleContextMenu}
      >
        {space.color && (
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: space.color }}
          />
        )}
        <span className="flex-shrink-0">
          {space.icon || (space.isDefault ? '📥' : '📁')}
        </span>
        <span className="flex-1 truncate">{space.name}</span>
        <span className="text-xs bg-[#e8f4fc] px-1.5 py-0.5 rounded-full text-text-muted">
          {cardCount}
        </span>
      </button>

      {contextMenu && (
        <ContextMenu
          items={contextMenu.items}
          position={contextMenu.position}
          onClose={hideContextMenu}
        />
      )}

      <Modal open={isEditing} onOpenChange={setIsEditing} title="Edit Space">
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Icon"
              value={editIcon}
              onChange={(e) => setEditIcon(e.target.value)}
              className="w-16 text-center"
              maxLength={2}
            />
            <Input
              placeholder="Space name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <p className="text-sm text-text-muted mb-2">Color</p>
            <div className="flex gap-1.5 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={clsx(
                    'w-6 h-6 rounded-full border-2 transition-transform',
                    editColor === c ? 'border-white ring-2 ring-offset-1 ring-gray-400 scale-110' : 'border-transparent hover:scale-110'
                  )}
                  style={{ backgroundColor: c }}
                  onClick={() => setEditColor(editColor === c ? null : c)}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveEdit}>
              Save
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
