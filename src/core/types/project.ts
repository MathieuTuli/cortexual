import { z } from 'zod'
import type { Card } from './card'

export const ProjectStatusEnum = z.enum(['active', 'archived'])
export type ProjectStatus = z.infer<typeof ProjectStatusEnum>

/**
 * A project is a working set: it pulls cards from any space, owns a canvas, and
 * holds the notes you write while the work is live. Spaces are where a card
 * lives permanently; a project is what you are doing with it, so the two are
 * independent memberships rather than a hierarchy.
 */
export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  color: z.string().optional(),
  status: ProjectStatusEnum,
  sortOrder: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
})

export type Project = z.infer<typeof ProjectSchema>

export type CreateProjectInput = Pick<Project, 'name'> &
  Partial<Pick<Project, 'description' | 'color'>>
export type UpdateProjectInput = Partial<
  Pick<Project, 'name' | 'description' | 'color' | 'status'>
>

/**
 * Unlike spaces there is no Uncategorized project — a card outside every
 * project is not in a bucket, it is simply not part of any work.
 */
export function cardIsInProject(card: Card, projectId: string): boolean {
  return card.projectIds?.includes(projectId) ?? false
}

export function cardProjects(card: Card, projects: Project[]): Project[] {
  return projects.filter((p) => card.projectIds?.includes(p.id) ?? false)
}

/** Note cards filed into a project are its documents. */
export function projectDocs(cards: Card[], projectId: string) {
  return cards
    .filter((c) => c.type === 'note' && cardIsInProject(c, projectId))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

/**
 * A note written in a project's docs pane rather than captured into the library.
 *
 * This used to be inferred — a note in a project with no spaceIds — which was
 * wrong, because an empty spaceIds is not "belongs nowhere", it is how a card
 * says it is in Uncategorized. So a note captured from All cards while a
 * project happened to be selected was indistinguishable from a document, and
 * the library swallowed it: saved, but nowhere to be seen. Nothing can tell
 * those two apart after the fact, so a document now says that it is one.
 */
export function isProjectDoc(card: Card): boolean {
  return card.type === 'note' && card.isDoc === true
}

/** What the library shows and counts: everything except project-only documents. */
export function libraryCards(cards: Card[]): Card[] {
  return cards.filter((c) => !isProjectDoc(c))
}
