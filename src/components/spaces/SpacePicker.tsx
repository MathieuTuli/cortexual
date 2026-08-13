import { useSpacesStore } from '@/core/stores'
import { DEFAULT_SPACE_ID } from '@/core/types'
import { MembershipPicker } from '../ui'

/**
 * A card with no space selected is uncategorized, which is why Uncategorized
 * itself isn't offered as a choice.
 */
export function SpacePicker({
  value,
  onChange,
}: {
  value: string[]
  onChange: (spaceIds: string[]) => void
}) {
  const spaces = useSpacesStore((s) => s.spaces).filter((s) => s.id !== DEFAULT_SPACE_ID)

  return (
    <MembershipPicker
      label="Spaces"
      items={spaces}
      value={value}
      onChange={onChange}
      empty="No spaces yet."
      hint="None selected — this card stays uncategorized."
    />
  )
}
