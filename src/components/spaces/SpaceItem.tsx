import { useState } from 'react'
import type { Space } from '@/core/types'
import { cardIsInSpace } from '@/core/types'
import { useSpacesStore, useCardsStore } from '@/core/stores'
import { go } from '@/core/router'
import { clsx } from 'clsx'
import { ContextMenu, useContextMenu, type ContextMenuItem, Modal, Input, Button, NavRow } from '../ui'
import { SPACE_COLORS } from '@/core/palette'

interface SpaceItemProps {
  space: Space
}

export function SpaceItem({ space }: SpaceItemProps) {
  const activeSpaceId = useSpacesStore((s) => s.activeSpaceId)
  const updateSpace = useSpacesStore((s) => s.updateSpace)
  const deleteSpace = useSpacesStore((s) => s.deleteSpace)
  const cards = useCardsStore((s) => s.cards)

  const { contextMenu, showContextMenu, hideContextMenu } = useContextMenu()
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(space.name)
  const [editColor, setEditColor] = useState(space.color || null)
  const [editIcon, setEditIcon] = useState(space.icon || '')

  const cardCount = cards.filter((c) => cardIsInSpace(c, space.id)).length
  const isActive = activeSpaceId === space.id

  const handleContextMenu = (e: React.MouseEvent) => {
    if (space.isDefault) return

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
          if (confirm(`Delete "${space.name}"? Its ${cardCount} cards stay in your library.`)) {
            deleteSpace(space.id)
            if (activeSpaceId === space.id) go({ name: 'library', spaceId: null })
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
      <NavRow
        label={space.name}
        trailing={cardCount}
        active={isActive}
        onClick={() => go({ name: 'library', spaceId: space.id })}
        onContextMenu={handleContextMenu}
      />

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
            <p className="section-label mb-2.5">Color</p>
            <div className="flex gap-2 flex-wrap">
              {SPACE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={clsx(
                    'w-7 h-7 rounded-full transition-transform',
                    editColor === c ? 'ring-2 ring-offset-2 ring-accent scale-110' : 'hover:scale-110'
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
