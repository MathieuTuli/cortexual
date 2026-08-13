import { useState } from 'react'
import {
  useAppStore,
  useCardsStore,
  useProjectsStore,
  useSpacesStore,
  type MembershipField,
} from '@/core/stores'
import { DEFAULT_SPACE_ID } from '@/core/types'

interface Target {
  id: string
  name: string
  color?: string
}

function AddToMenu({
  label,
  targets,
  open,
  onToggle,
  onPick,
}: {
  label: string
  targets: Target[]
  open: boolean
  onToggle: () => void
  onPick: (id: string) => void
}) {
  return (
    <div className="relative">
      <button
        onClick={onToggle}
        disabled={targets.length === 0}
        className="text-sm text-white/80 hover:text-white disabled:text-white/35 disabled:cursor-not-allowed transition-colors"
      >
        {label}
      </button>

      {open && targets.length > 0 && (
        <div className="absolute bottom-full mb-2 left-0 bg-bg text-text rounded-lg shadow-pop p-1.5 min-w-[190px] max-h-72 overflow-y-auto">
          {targets.map((target) => (
            <button
              key={target.id}
              className="w-full h-9 px-3 rounded text-left text-sm hover:bg-chip transition-colors flex items-center gap-2.5"
              onClick={() => onPick(target.id)}
            >
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: target.color || 'var(--text-faint)' }}
              />
              <span className="truncate">{target.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function SelectionActionBar() {
  const selectedCardIds = useAppStore((s) => s.selectedCardIds)
  const clearSelection = useAppStore((s) => s.clearSelection)
  const setMembership = useCardsStore((s) => s.setMembership)
  const spaces = useSpacesStore((s) => s.spaces)
  const projects = useProjectsStore((s) => s.projects)

  const [openMenu, setOpenMenu] = useState<MembershipField | null>(null)

  const selectedCount = selectedCardIds.size
  if (selectedCount === 0) return null

  const add = (field: MembershipField) => async (id: string) => {
    await setMembership(Array.from(selectedCardIds), field, id, 'add')
    clearSelection()
    setOpenMenu(null)
  }

  const toggle = (field: MembershipField) => () =>
    setOpenMenu((current) => (current === field ? null : field))

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="bg-text text-white rounded-full shadow-pop h-12 px-6 flex items-center gap-3">
        <span className="text-sm font-medium">
          {selectedCount} card{selectedCount !== 1 ? 's' : ''} selected
        </span>

        <span className="w-px h-5 bg-white/25" />

        <AddToMenu
          label="Add to space"
          targets={spaces.filter((s) => s.id !== DEFAULT_SPACE_ID)}
          open={openMenu === 'spaceIds'}
          onToggle={toggle('spaceIds')}
          onPick={add('spaceIds')}
        />

        <span className="w-px h-5 bg-white/25" />

        <AddToMenu
          label="Add to project"
          targets={projects.filter((p) => p.status === 'active')}
          open={openMenu === 'projectIds'}
          onToggle={toggle('projectIds')}
          onPick={add('projectIds')}
        />

        <span className="w-px h-5 bg-white/25" />

        <button
          onClick={clearSelection}
          className="text-sm text-white/80 hover:text-white transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
