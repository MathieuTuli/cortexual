import type { Card as CardType } from '@/core/types'
import { DEFAULT_SPACE_ID } from '@/core/types'
import { useAppStore, useCardsStore, useSpacesStore } from '@/core/stores'
import { Tag, IconButton, ContextMenu, useContextMenu, type ContextMenuItem } from '../ui'
import { CardNote } from './CardNote'
import { CardMedia } from './CardMedia'
import { CardLink } from './CardLink'
import { clsx } from 'clsx'
import { useState } from 'react'

interface CardProps {
  card: CardType
}

export function Card({ card }: CardProps) {
  const openViewModal = useAppStore((s) => s.openViewModal)
  const openEditModal = useAppStore((s) => s.openEditModal)
  const deleteCard = useCardsStore((s) => s.deleteCard)
  const moveCardsToSpace = useCardsStore((s) => s.moveCardsToSpace)
  const addFilterTag = useCardsStore((s) => s.addFilterTag)
  const selectedCardIds = useAppStore((s) => s.selectedCardIds)
  const toggleCardSelection = useAppStore((s) => s.toggleCardSelection)
  const isSelecting = useAppStore((s) => s.isSelecting)
  const spaces = useSpacesStore((s) => s.spaces)

  const { contextMenu, showContextMenu, hideContextMenu } = useContextMenu()
  const [showMoveMenu, setShowMoveMenu] = useState<{ x: number; y: number } | null>(null)

  const isSelected = selectedCardIds.has(card.id)

  // Get space for the tag
  const space = spaces.find((s) => s.id === card.spaceId)

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm('Delete this card?')) {
      await deleteCard(card.id)
    }
  }

  const handleClick = (e: React.MouseEvent) => {
    // If shift/ctrl/cmd is held, toggle selection
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      e.preventDefault()
      toggleCardSelection(card.id)
      return
    }

    // If we're in selection mode, toggle selection
    if (isSelecting || selectedCardIds.size > 0) {
      toggleCardSelection(card.id)
      return
    }

    // Normal click opens view modal
    openViewModal(card.id)
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    const items: ContextMenuItem[] = [
      {
        label: 'View',
        icon: '👁️',
        onClick: () => openViewModal(card.id),
      },
      {
        label: 'Edit',
        icon: '✏️',
        onClick: () => openEditModal(card.id),
      },
      { label: '', divider: true, onClick: () => {} },
      {
        label: 'Move to Space',
        icon: '📁',
        onClick: () => {
          setShowMoveMenu({ x: e.clientX, y: e.clientY })
        },
      },
      { label: '', divider: true, onClick: () => {} },
      {
        label: 'Delete',
        icon: '🗑️',
        danger: true,
        onClick: async () => {
          if (confirm('Delete this card?')) {
            await deleteCard(card.id)
          }
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
      setShowMoveMenu(null)
    },
    disabled: s.id === card.spaceId,
  }))

  return (
  <>
    <article
      data-card-id={card.id}
      className={clsx(
        'group rounded-lg overflow-hidden relative w-full max-w-full min-w-0',
        // Y2K raised panel style
        'bg-gradient-to-b from-white to-[#f0f8ff]',
        'border-2',
        isSelected
          ? 'border-accent-primary ring-2 ring-accent-primary ring-opacity-50'
          : 'border-t-[#ffffff] border-l-[#d0e8ff] border-b-[#88b0d0] border-r-[#88b0d0]',
        'shadow-y2k',
        'hover:shadow-[4px_4px_12px_rgba(0,100,200,0.25)]',
        'transition-all cursor-pointer',
        'select-none' // Prevent text selection on cards
      )}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute top-1 left-1 z-10 bg-accent-primary text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shadow">
          ✓
        </div>
      )}

      {/* Content */}
      <div className="p-2">
        {card.title && (
          <h3 className="font-bold text-xs text-accent-primary mb-1">
            {card.title}
          </h3>
        )}

        {card.type === 'note' && <CardNote card={card} />}
        {(card.type === 'image' || card.type === 'video') && <CardMedia card={card} />}
        {card.type === 'link' && <CardLink card={card} />}
      </div>

      {/* Tags */}
      {card.tags.length > 0 && (
        <div className="px-2 pb-1 flex flex-wrap gap-0.5">
          {card.tags.map((tag, index) => (
            <Tag
              key={`${tag}-${index}`}
              onClick={() => addFilterTag(tag)}
            >
              {tag}
            </Tag>
          ))}
        </div>
      )}

      {/* Subnotes count */}
      {card.subnotes.length > 0 && (
        <div className="px-2 pb-1">
          <p className="text-xs text-text-muted">
            📝 {card.subnotes.length} note{card.subnotes.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      {/* Space tag - Y2K beveled pill style */}
      {space && card.spaceId !== DEFAULT_SPACE_ID && (
        <div className="px-2 pb-1">
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white shadow-[inset_1px_1px_0_rgba(255,255,255,0.4),inset_-1px_-1px_0_rgba(0,0,0,0.2)]"
            style={{ backgroundColor: space.color || '#6366f1' }}
          >
            <span>{space.icon || '📁'}</span>
            <span className="truncate max-w-[80px]">{space.name}</span>
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="px-2 pb-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <IconButton
          size="sm"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation()
            openEditModal(card.id)
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
        </IconButton>
        <IconButton
          size="sm"
          variant="ghost"
          onClick={handleDelete}
          className="hover:text-red-500"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
        </IconButton>
      </div>
    </article>

    {/* Context menus */}
    {contextMenu && (
      <ContextMenu
        items={contextMenu.items}
        position={contextMenu.position}
        onClose={hideContextMenu}
      />
    )}

    {showMoveMenu && (
      <ContextMenu
        items={moveMenuItems}
        position={showMoveMenu}
        onClose={() => setShowMoveMenu(null)}
      />
    )}
  </>
  )
}
