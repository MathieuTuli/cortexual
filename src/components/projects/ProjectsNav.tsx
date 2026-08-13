import { useState } from 'react'
import { useCardsStore, useProjectsStore } from '@/core/stores'
import { cardIsInProject } from '@/core/types'
import { go } from '@/core/router'
import { Input, Button, NavRow } from '../ui'

function NewProjectForm({ onClose }: { onClose: () => void }) {
  const createProject = useProjectsStore((s) => s.createProject)
  const [name, setName] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    const project = await createProject({ name: name.trim() })
    onClose()
    go({ name: 'projects', projectId: project.id })
  }

  return (
    <form onSubmit={submit} className="px-3 pt-3 space-y-2">
      <Input
        placeholder="Project name…"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="primary" disabled={!name.trim()}>
          Create
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

function Section({
  title,
  action,
  children,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section>
      <div className="px-3 pb-2 flex items-center justify-between">
        <span className="section-label">{title}</span>
        {action}
      </div>
      {children}
    </section>
  )
}

export function ProjectsNav() {
  const projects = useProjectsStore((s) => s.projects)
  const activeProjectId = useProjectsStore((s) => s.activeProjectId)
  const cards = useCardsStore((s) => s.cards)
  const [showForm, setShowForm] = useState(false)

  const countFor = (projectId: string) =>
    cards.filter((c) => cardIsInProject(c, projectId)).length

  const active = projects.filter((p) => p.status === 'active')
  const archived = projects.filter((p) => p.status === 'archived')

  const row = (project: (typeof projects)[number]) => (
    <NavRow
      key={project.id}
      label={project.name}
      trailing={countFor(project.id)}
      active={activeProjectId === project.id}
      onClick={() => go({ name: 'projects', projectId: project.id })}
    />
  )

  return (
    <>
      <Section
        title="Projects"
        action={
          <button
            onClick={() => setShowForm(true)}
            className="w-6 h-6 rounded-full flex items-center justify-center text-text-faint hover:text-text hover:bg-chip transition-colors"
            title="New project"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
          </button>
        }
      >
        {active.length === 0 && !showForm ? (
          <p className="px-3 text-sm text-text-faint">Nothing on the go.</p>
        ) : (
          <div>{active.map(row)}</div>
        )}
        {showForm && <NewProjectForm onClose={() => setShowForm(false)} />}
      </Section>

      {archived.length > 0 && <Section title="Archived">{archived.map(row)}</Section>}
    </>
  )
}
