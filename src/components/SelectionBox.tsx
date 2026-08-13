import { useEffect, useState, useRef, useCallback } from 'react'
import { useAppStore } from '@/core/stores'

interface SelectionRect {
  startX: number
  startY: number
  currentX: number
  currentY: number
}

export function useSelectionBox(containerRef: React.RefObject<HTMLElement>) {
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null)
  const selectCards = useAppStore((s) => s.selectCards)
  const clearSelection = useAppStore((s) => s.clearSelection)
  const setIsSelecting = useAppStore((s) => s.setIsSelecting)

  // Use refs to avoid stale closures
  const isSelectingRef = useRef(false)
  const startPosRef = useRef({ x: 0, y: 0 })
  const selectionRectRef = useRef<SelectionRect | null>(null)

  const getCardsInRect = useCallback((rect: SelectionRect) => {
    if (!containerRef.current) return []

    const minX = Math.min(rect.startX, rect.currentX)
    const maxX = Math.max(rect.startX, rect.currentX)
    const minY = Math.min(rect.startY, rect.currentY)
    const maxY = Math.max(rect.startY, rect.currentY)

    const cardElements = containerRef.current.querySelectorAll('[data-card-id]')
    const selectedIds: string[] = []

    cardElements.forEach((element) => {
      const cardRect = element.getBoundingClientRect()
      const containerRect = containerRef.current!.getBoundingClientRect()

      // Convert to container-relative coordinates
      const cardLeft = cardRect.left - containerRect.left + containerRef.current!.scrollLeft
      const cardRight = cardRect.right - containerRect.left + containerRef.current!.scrollLeft
      const cardTop = cardRect.top - containerRect.top + containerRef.current!.scrollTop
      const cardBottom = cardRect.bottom - containerRect.top + containerRef.current!.scrollTop

      // Check if card intersects with selection rectangle
      if (cardLeft < maxX && cardRight > minX && cardTop < maxY && cardBottom > minY) {
        const cardId = element.getAttribute('data-card-id')
        if (cardId) selectedIds.push(cardId)
      }
    })

    return selectedIds
  }, [containerRef])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleMouseDown = (e: MouseEvent) => {
      // Only start selection on left click
      if (e.button !== 0) return

      // Don't start selection if clicking on a card or interactive element
      const target = e.target as HTMLElement
      if (target.closest('[data-card-id]') ||
          target.closest('button') ||
          target.closest('a') ||
          target.closest('input') ||
          target.closest('select')) return

      // Must be clicking within the container
      if (!container.contains(target)) return

      e.preventDefault()

      const containerRect = container.getBoundingClientRect()
      const startX = e.clientX - containerRect.left + container.scrollLeft
      const startY = e.clientY - containerRect.top + container.scrollTop

      // If not holding shift/ctrl, clear existing selection
      if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
        clearSelection()
      }

      startPosRef.current = { x: startX, y: startY }
      const rect = { startX, startY, currentX: startX, currentY: startY }
      selectionRectRef.current = rect
      setSelectionRect(rect)
      isSelectingRef.current = true
      setIsSelecting(true)
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!isSelectingRef.current) return

      const containerRect = container.getBoundingClientRect()
      const currentX = e.clientX - containerRect.left + container.scrollLeft
      const currentY = e.clientY - containerRect.top + container.scrollTop

      const rect = {
        startX: startPosRef.current.x,
        startY: startPosRef.current.y,
        currentX,
        currentY,
      }
      selectionRectRef.current = rect
      setSelectionRect(rect)
    }

    const handleMouseUp = () => {
      if (!isSelectingRef.current) return

      const rect = selectionRectRef.current
      if (rect) {
        const cardIds = getCardsInRect(rect)
        if (cardIds.length > 0) {
          selectCards(cardIds)
        }
      }

      setSelectionRect(null)
      selectionRectRef.current = null
      isSelectingRef.current = false
      setIsSelecting(false)
    }

    container.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      container.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [containerRef, clearSelection, setIsSelecting, selectCards, getCardsInRect])

  // Calculate the visible rectangle for rendering
  const visibleRect = selectionRect ? {
    left: Math.min(selectionRect.startX, selectionRect.currentX),
    top: Math.min(selectionRect.startY, selectionRect.currentY),
    width: Math.abs(selectionRect.currentX - selectionRect.startX),
    height: Math.abs(selectionRect.currentY - selectionRect.startY),
  } : null

  return { selectionRect: visibleRect }
}

interface SelectionBoxOverlayProps {
  rect: { left: number; top: number; width: number; height: number } | null
}

export function SelectionBoxOverlay({ rect }: SelectionBoxOverlayProps) {
  if (!rect || rect.width < 5 || rect.height < 5) return null

  return (
    <div
      className="absolute pointer-events-none border-2 border-accent bg-accent/10 rounded z-50"
      style={{
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      }}
    />
  )
}
