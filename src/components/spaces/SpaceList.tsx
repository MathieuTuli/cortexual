import { useSpacesStore } from '@/core/stores'
import { SpaceItem } from './SpaceItem'
import { SpaceForm } from './SpaceForm'
import { useState } from 'react'

export function SpaceList() {
  const spaces = useSpacesStore((s) => s.spaces)
  const [showForm, setShowForm] = useState(false)

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
        {spaces.map((space) => (
          <SpaceItem key={space.id} space={space} />
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
