import { useSpacesStore } from '@/core/stores'
import { DEFAULT_SPACE_ID } from '@/core/types'
import { clsx } from 'clsx'

/**
 * Toggleable chips, one per space. A card with none selected is uncategorized,
 * which is why Uncategorized itself isn't offered as a choice.
 */
export function SpacePicker({
  value,
  onChange,
}: {
  value: string[]
  onChange: (spaceIds: string[]) => void
}) {
  const spaces = useSpacesStore((s) => s.spaces).filter((s) => s.id !== DEFAULT_SPACE_ID)

  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])

  return (
    <div>
      <label className="section-label block mb-1.5">Spaces</label>

      {spaces.length === 0 ? (
        <p className="text-xs text-text-muted">No spaces yet.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {spaces.map((space) => {
            const selected = value.includes(space.id)
            return (
              <button
                key={space.id}
                type="button"
                onClick={() => toggle(space.id)}
                aria-pressed={selected}
                className={clsx(
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-colors border',
                  selected
                    ? 'bg-[#0f172a] text-white border-transparent'
                    : 'bg-white text-text border-[var(--color-border)] hover:border-[var(--color-border-bold)]'
                )}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: selected ? '#fff' : space.color || '#94a3b8' }}
                />
                {space.icon ? `${space.icon} ` : ''}
                {space.name}
              </button>
            )
          })}
        </div>
      )}

      {value.length === 0 && spaces.length > 0 && (
        <p className="text-[11px] text-text-muted mt-1.5">
          None selected — this card stays uncategorized.
        </p>
      )}
    </div>
  )
}
