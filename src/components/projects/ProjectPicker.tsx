import { useProjectsStore } from '@/core/stores'
import { MembershipPicker } from '../ui'

export function ProjectPicker({
  value,
  onChange,
}: {
  value: string[]
  onChange: (projectIds: string[]) => void
}) {
  const projects = useProjectsStore((s) => s.projects).filter((p) => p.status === 'active')

  return (
    <MembershipPicker
      label="Projects"
      items={projects}
      value={value}
      onChange={onChange}
      empty="No active projects."
    />
  )
}
