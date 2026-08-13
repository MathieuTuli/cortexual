import { useState } from 'react'
import type { Card } from '@/core/types'
import { DEFAULT_SPACE_ID } from '@/core/types'
import {
  useAppStore,
  useCardsStore,
  useProjectsStore,
  useSpacesStore,
  type MembershipField,
} from '@/core/stores'
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
  const setMembership = useCardsStore((s) => s.setMembership)
  const spaces = useSpacesStore((s) => s.spaces)
  const projects = useProjectsStore((s) => s.projects)

  const { contextMenu, showContextMenu, hideContextMenu } = useContextMenu()
  const [submenu, setSubmenu] = useState<{ field: MembershipField; x: number; y: number } | null>(
    null
  )

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
        onClick: () => setSubmenu({ field: 'spaceIds', x: e.clientX, y: e.clientY }),
      },
      {
        label: 'Projects',
        icon: '🗂️',
        disabled: projects.length === 0,
        onClick: () => setSubmenu({ field: 'projectIds', x: e.clientX, y: e.clientY }),
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

  // A card sits in as many spaces and projects as you like, so these toggle
  // membership rather than moving anything. Uncategorized isn't a real space —
  // it's what you get by leaving all of them.
  const membershipItems = (field: MembershipField): ContextMenuItem[] => {
    const targets =
      field === 'spaceIds'
        ? spaces.filter((s) => s.id !== DEFAULT_SPACE_ID).map((s) => ({ ...s, glyph: s.icon || '📁' }))
        : projects.filter((p) => p.status === 'active').map((p) => ({ ...p, glyph: '🗂️' }))

    return targets.map((target) => {
      const member = card[field].includes(target.id)
      return {
        label: member ? `✓ ${target.name}` : target.name,
        icon: target.glyph,
        onClick: async () => {
          await setMembership([card.id], field, target.id, member ? 'remove' : 'add')
          setSubmenu(null)
        },
      }
    })
  }

  const menus = (
    <>
      {contextMenu && (
        <ContextMenu
          items={contextMenu.items}
          position={contextMenu.position}
          onClose={hideContextMenu}
        />
      )}
      {submenu && (
        <ContextMenu
          items={membershipItems(submenu.field)}
          position={{ x: submenu.x, y: submenu.y }}
          onClose={() => setSubmenu(null)}
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
