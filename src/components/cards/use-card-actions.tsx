import { useState } from 'react'
import type { Card } from '@/core/types'
import { DEFAULT_SPACE_ID } from '@/core/types'
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
  const addCardsToSpace = useCardsStore((s) => s.addCardsToSpace)
  const removeCardsFromSpace = useCardsStore((s) => s.removeCardsFromSpace)
  const spaces = useSpacesStore((s) => s.spaces)

  const { contextMenu, showContextMenu, hideContextMenu } = useContextMenu()
  const [spaceMenuPosition, setSpaceMenuPosition] = useState<{ x: number; y: number } | null>(null)

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
        label: 'Spaces',
        icon: '📁',
        onClick: () => setSpaceMenuPosition({ x: e.clientX, y: e.clientY }),
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

  // A card can sit in several spaces, so this menu toggles membership rather
  // than moving the card. Uncategorized isn't a real space — it's what you get
  // by leaving all of them.
  const spaceMenuItems: ContextMenuItem[] = spaces
    .filter((s) => s.id !== DEFAULT_SPACE_ID)
    .map((s) => {
      const member = card.spaceIds.includes(s.id)
      return {
        label: member ? `✓ ${s.name}` : s.name,
        icon: s.icon || '📁',
        onClick: async () => {
          if (member) await removeCardsFromSpace([card.id], s.id)
          else await addCardsToSpace([card.id], s.id)
          setSpaceMenuPosition(null)
        },
      }
    })

  const menus = (
    <>
      {contextMenu && (
        <ContextMenu
          items={contextMenu.items}
          position={contextMenu.position}
          onClose={hideContextMenu}
        />
      )}
      {spaceMenuPosition && (
        <ContextMenu
          items={spaceMenuItems}
          position={spaceMenuPosition}
          onClose={() => setSpaceMenuPosition(null)}
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
