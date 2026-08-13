import { create } from 'zustand'
import { api } from '../api'
import type { CreateProjectInput, Project, UpdateProjectInput } from '../types'
import { SPACE_COLORS } from '../palette'
import { generateId } from '../utils'
import { useCardsStore } from './cards-store'

interface ProjectsState {
  projects: Project[]
  isLoading: boolean
  error: string | null
  activeProjectId: string | null

  loadProjects: () => Promise<void>
  createProject: (input: CreateProjectInput) => Promise<Project>
  updateProject: (id: string, changes: UpdateProjectInput) => Promise<void>
  deleteProject: (id: string) => Promise<void>
  setActiveProject: (id: string | null) => void
  getProjectById: (id: string) => Project | undefined
}

export const useProjectsStore = create<ProjectsState>((set, get) => ({
  projects: [],
  isLoading: false,
  error: null,
  activeProjectId: null,

  loadProjects: async () => {
    set({ isLoading: true })
    try {
      const all = await api.getProjects()
      const projects = (all as Project[])
        .filter((p) => p.deletedAt === null)
        .sort((a, b) => a.sortOrder - b.sortOrder)
      set({ projects, isLoading: false })
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false })
    }
  },

  createProject: async (input) => {
    const now = new Date().toISOString()
    const existing = get().projects
    const project: Project = {
      id: generateId(),
      name: input.name,
      description: input.description,
      color: input.color || SPACE_COLORS[existing.length % SPACE_COLORS.length],
      status: 'active',
      sortOrder: existing.length,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    }

    set((state) => ({ projects: [...state.projects, project] }))
    await api.createProject(project)
    return project
  },

  updateProject: async (id, changes) => {
    const updatedAt = new Date().toISOString()
    set((state) => ({
      projects: state.projects.map((p) => (p.id === id ? { ...p, ...changes, updatedAt } : p)),
    }))
    await api.updateProject(id, { ...changes, updatedAt })
  },

  /** Unfiles the cards; they belong to their spaces, not to the project. */
  deleteProject: async (id) => {
    await useCardsStore.getState().setMembership(null, 'projectIds', id, 'remove')

    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      activeProjectId: state.activeProjectId === id ? null : state.activeProjectId,
    }))

    await api.deleteProject(id)
  },

  setActiveProject: (id) => set({ activeProjectId: id }),

  getProjectById: (id) => get().projects.find((p) => p.id === id),
}))
