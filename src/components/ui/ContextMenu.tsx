import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export interface ContextMenuItem {
  label: string
  icon?: string
  onClick: () => void
  danger?: boolean
  disabled?: boolean
  divider?: boolean
}

export interface ContextMenuPosition {
  x: number
  y: number
}

interface ContextMenuProps {
  items: ContextMenuItem[]
  position: ContextMenuPosition
  onClose: () => void
}

export function ContextMenu({ items, position, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    // Small delay to prevent immediate close from the same click
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
    }, 0)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  // Adjust position to stay within viewport
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      let adjustedX = position.x
      let adjustedY = position.y

      if (position.x + rect.width > viewportWidth) {
        adjustedX = viewportWidth - rect.width - 8
      }
      if (position.y + rect.height > viewportHeight) {
        adjustedY = viewportHeight - rect.height - 8
      }

      menuRef.current.style.left = `${adjustedX}px`
      menuRef.current.style.top = `${adjustedY}px`
    }
  }, [position])

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[100] min-w-[160px] py-1 bg-gradient-to-b from-white to-[#f0f8ff] rounded-lg border-2 border-t-[#ffffff] border-l-[#d0e8ff] border-b-[#88b0d0] border-r-[#88b0d0] shadow-y2k"
      style={{ left: position.x, top: position.y }}
    >
      {items.map((item, index) => {
        if (item.divider) {
          return (
            <div
              key={`divider-${index}`}
              className="my-1 mx-2 border-t border-[#c0d8f0]"
            />
          )
        }

        return (
          <button
            key={item.label}
            className={`w-full px-3 py-1.5 text-left text-sm flex items-center gap-2 transition-colors ${
              item.disabled
                ? 'text-gray-400 cursor-not-allowed'
                : item.danger
                  ? 'text-red-600 hover:bg-red-50'
                  : 'text-text hover:bg-[#e0f0ff]'
            }`}
            onClick={() => {
              if (!item.disabled) {
                item.onClick()
                onClose()
              }
            }}
            disabled={item.disabled}
          >
            {item.icon && <span className="w-4 text-center">{item.icon}</span>}
            <span>{item.label}</span>
          </button>
        )
      })}
    </div>,
    document.body
  )
}

// Hook for managing context menu state
export function useContextMenu() {
  const [contextMenu, setContextMenu] = useState<{
    items: ContextMenuItem[]
    position: ContextMenuPosition
  } | null>(null)

  const showContextMenu = (
    e: React.MouseEvent,
    items: ContextMenuItem[]
  ) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({
      items,
      position: { x: e.clientX, y: e.clientY },
    })
  }

  const hideContextMenu = () => {
    setContextMenu(null)
  }

  return { contextMenu, showContextMenu, hideContextMenu }
}
