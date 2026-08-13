import { clsx } from 'clsx'

export interface PickerItem {
  id: string
  name: string
  color?: string
  icon?: string
}

interface MembershipPickerProps {
  label: string
  items: PickerItem[]
  value: string[]
  onChange: (ids: string[]) => void
  /** Shown when there is nothing to pick from. */
  empty: string
  /** Shown when nothing is selected, to explain what that means. */
  hint?: string
}

/** Toggleable chips for filing a card into spaces or projects. */
export function MembershipPicker({
  label,
  items,
  value,
  onChange,
  empty,
  hint,
}: MembershipPickerProps) {
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])

  return (
    <div>
      <label className="section-label block mb-2">{label}</label>

      {items.length === 0 ? (
        <p className="text-sm text-text-faint">{empty}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item) => {
            const selected = value.includes(item.id)
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggle(item.id)}
                aria-pressed={selected}
                className={clsx(
                  'inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-xs transition-colors',
                  selected ? 'bg-accent text-white' : 'bg-chip text-text-body hover:bg-sunken'
                )}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: selected ? 'var(--white)' : item.color || 'var(--text-faint)' }}
                />
                {item.icon ? `${item.icon} ` : ''}
                {item.name}
              </button>
            )
          })}
        </div>
      )}

      {hint && value.length === 0 && items.length > 0 && (
        <p className="text-xs text-text-faint mt-2">{hint}</p>
      )}
    </div>
  )
}
