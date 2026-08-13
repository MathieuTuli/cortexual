import { useSpacesStore } from '@/core/stores'
import { SpaceItem } from './SpaceItem'
import { SpaceForm } from './SpaceForm'
import { useState, useRef } from 'react'

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
    <section>
      <div className="px-3 pb-2 flex items-center justify-between">
        <span className="section-label">Spaces</span>
        <button
          onClick={() => setShowForm(true)}
          className="w-6 h-6 rounded-full flex items-center justify-center text-text-faint hover:text-text hover:bg-chip transition-colors"
          title="New space"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
        </button>
      </div>

      <div>
        {spaces.map((space, index) => (
          <div
            key={space.id}
            draggable={!space.isDefault}
            onDragStart={(e) => handleDragStart(e, index)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={(e) => handleDrop(e, index)}
            className={
              dragOverIndex === index && draggedIndex !== index ? 'border-t border-accent' : ''
            }
          >
            <SpaceItem space={space} />
          </div>
        ))}
      </div>

      {showForm && (
        <div className="px-3 pt-3">
          <SpaceForm onClose={() => setShowForm(false)} />
        </div>
      )}
    </section>
  )
}
