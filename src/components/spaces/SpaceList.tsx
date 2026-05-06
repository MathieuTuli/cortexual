import { useSpacesStore } from '@/core/stores'
import { SpaceItem } from './SpaceItem'
import { SpaceForm } from './SpaceForm'
import { useState, useRef } from 'react'
import { Button } from '../ui'

export function SpaceList() {
  const spaces = useSpacesStore((s) => s.spaces)
  const reorderSpaces = useSpacesStore((s) => s.reorderSpaces)
  const [showForm, setShowForm] = useState(false)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const dragNodeRef = useRef<HTMLDivElement | null>(null)

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    dragNodeRef.current = e.target as HTMLDivElement
    e.dataTransfer.effectAllowed = 'move'
    // Add a slight delay to allow the drag image to be captured
    setTimeout(() => {
      if (dragNodeRef.current) {
        dragNodeRef.current.style.opacity = '0.5'
      }
    }, 0)
  }

  const handleDragEnd = () => {
    if (dragNodeRef.current) {
      dragNodeRef.current.style.opacity = '1'
    }
    setDraggedIndex(null)
    setDragOverIndex(null)
    dragNodeRef.current = null
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return
    setDragOverIndex(index)
  }

  const handleDrop = async (e: React.DragEvent, toIndex: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === toIndex) return
    await reorderSpaces(draggedIndex, toIndex)
    handleDragEnd()
  }

  return (
    <div className="py-2">
      <div className="px-4 py-2 flex items-center justify-between">
        <span className="text-xs font-bold text-text-muted uppercase tracking-wider">
          📂 Spaces
        </span>
      </div>

      <div className="space-y-1">
        {spaces.map((space, index) => (
          <div
            key={space.id}
            draggable={!space.isDefault}
            onDragStart={(e) => handleDragStart(e, index)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={(e) => handleDrop(e, index)}
            className={
              dragOverIndex === index && draggedIndex !== index
                ? 'border-t-2 border-accent-primary'
                : ''
            }
          >
            <SpaceItem space={space} />
          </div>
        ))}
      </div>

      {showForm ? (
        <div className="px-3 py-2">
          <SpaceForm onClose={() => setShowForm(false)} />
        </div>
      ) : (
        <div className="px-3 py-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => setShowForm(true)}
          >
            ➕ New Space
          </Button>
        </div>
      )}
    </div>
  )
}
