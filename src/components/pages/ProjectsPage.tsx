import { useEffect } from 'react'
import { useProjectsStore } from '@/core/stores'
import { AppShell } from '../layout/AppShell'
import { ProjectsNav } from '../projects/ProjectsNav'
import { ProjectDetail } from '../projects/ProjectDetail'

function NoProjectSelected({ hasAny }: { hasAny: boolean }) {
  return (
    <div>
      <h1 className="font-display text-title text-text-faint mb-8">Projects</h1>
      <p className="text-lg text-text-muted">
        {hasAny ? 'Pick a project to open it.' : 'No projects yet.'}
      </p>
      <p className="mt-1 text-sm text-text-faint">
        A project gathers cards from any space, keeps its own canvas, and holds the notes you
        write while the work is live.
      </p>
    </div>
  )
}

export function ProjectsPage({ projectId }: { projectId: string | null }) {
  const projects = useProjectsStore((s) => s.projects)
  const setActiveProject = useProjectsStore((s) => s.setActiveProject)
  const getProjectById = useProjectsStore((s) => s.getProjectById)

  useEffect(() => {
    setActiveProject(projectId)
  }, [projectId, setActiveProject])

  const project = projectId ? getProjectById(projectId) : null

  return (
    <AppShell
      nav={<ProjectsNav />}
      searchPlaceholder={project ? `Search ${project.name}` : 'Search your library'}
    >
      {project ? (
        <ProjectDetail project={project} />
      ) : (
        <NoProjectSelected hasAny={projects.length > 0} />
      )}
    </AppShell>
  )
}
