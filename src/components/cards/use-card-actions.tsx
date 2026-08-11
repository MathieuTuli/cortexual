import { useState } from 'react'
import type { Card } from '@/core/types'
import { useAppStore, useCardsStore, useSpacesStore } from '@/core/stores'
import { ContextMenu, useContextMenu, type ContextMenuItem } from '../ui'

/**
 * Click / selection / context-menu behaviour shared by every representation of
 * a card (grid tile, list row). Render `menus` alongside the card element.
 */
export function useCardActions(card: Card) {
  const openViewModal = useAppStore((s) => s.openViewModal)
  const openEditModal = useAppStore((s) => s.openEditModal)
  const selectedCardIds = useAppStore((s) => s.selectedCardIds)
  const toggleCardSelection = useAppStore((s) => s.toggleCardSelection)
  const isSelecting = useAppStore((s) => s.isSelecting)
  const deleteCard = useCardsStore((s) => s.deleteCard)
  const moveCardsToSpace = useCardsStore((s) => s.moveCardsToSpace)
  const spaces = useSpacesStore((s) => s.spaces)

  const { contextMenu, showContextMenu, hideContextMenu } = useContextMenu()
  const [moveMenuPosition, setMoveMenuPosition] = useState<{ x: number; y: number } | null>(null)

  const onClick = (e: React.MouseEvent) => {
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      e.preventDefault()
      toggleCardSelection(card.id)
      return
    }
    if (isSelecting || selectedCardIds.size > 0) {
      toggleCardSelection(card.id)
      return
    }
    openViewModal(card.id)
  }

  const onMenu = (e: React.MouseEvent) => {
    e.stopPropagation()
    const items: ContextMenuItem[] = [
      { label: 'View', icon: '👁️', onClick: () => openViewModal(card.id) },
      { label: 'Edit', icon: '✏️', onClick: () => openEditModal(card.id) },
      { label: '', divider: true, onClick: () => {} },
      {
        label: 'Move to Space',
        icon: '📁',
        onClick: () => setMoveMenuPosition({ x: e.clientX, y: e.clientY }),
      },
      { label: '', divider: true, onClick: () => {} },
      {
        label: 'Delete',
        icon: '🗑️',
        danger: true,
        onClick: async () => {
          if (confirm('Delete this card?')) await deleteCard(card.id)
        },
      },
    ]
    showContextMenu(e, items)
  }

  const moveMenuItems: ContextMenuItem[] = spaces.map((s) => ({
    label: s.name,
    icon: s.icon || (s.isDefault ? '📥' : '📁'),
    onClick: async () => {
      await moveCardsToSpace([card.id], s.id)
      setMoveMenuPosition(null)
    },
    disabled: s.id === card.spaceId,
  }))

  const menus = (
    <>
      {contextMenu && (
        <ContextMenu
          items={contextMenu.items}
          position={contextMenu.position}
          onClose={hideContextMenu}
        />
      )}
      {moveMenuPosition && (
        <ContextMenu
          items={moveMenuItems}
          position={moveMenuPosition}
          onClose={() => setMoveMenuPosition(null)}
        />
      )}
    </>
  )

  return {
    isSelected: selectedCardIds.has(card.id),
    onClick,
    onMenu,
    menus,
  }
}
