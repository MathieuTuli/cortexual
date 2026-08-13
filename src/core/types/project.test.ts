import { describe, it, expect } from 'vitest'
import {
  ProjectSchema,
  cardIsInProject,
  cardProjects,
  isProjectDoc,
  libraryCards,
  projectDocs,
} from './project'
import type { Card } from './card'
import type { Project } from './project'

const now = '2026-01-01T00:00:00.000Z'

function project(id: string, over: Partial<Project> = {}): Project {
  return {
    id,
    name: id,
    status: 'active',
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...over,
  }
}

function note(id: string, projectIds: string[], updatedAt = now): Card {
  return {
    id,
    type: 'note',
    content: `body of ${id}`,
    spaceIds: [],
    projectIds,
    tags: [],
    subnotes: [],
    createdAt: now,
    updatedAt,
    deletedAt: null,
  }
}

function image(id: string, projectIds: string[]): Card {
  return {
    id,
    type: 'image',
    mediaIds: [],
    spaceIds: [],
    projectIds,
    tags: [],
    subnotes: [],
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }
}

describe('ProjectSchema', () => {
  it('accepts a minimal active project', () => {
    expect(() => ProjectSchema.parse(project('p1'))).not.toThrow()
  })

  it('rejects an unknown status', () => {
    expect(() => ProjectSchema.parse({ ...project('p1'), status: 'paused' })).toThrow()
  })

  it('rejects an empty name', () => {
    expect(() => ProjectSchema.parse({ ...project('p1'), name: '' })).toThrow()
  })
})

describe('cardIsInProject', () => {
  it('is true only for a listed project', () => {
    const card = note('c1', ['p1'])
    expect(cardIsInProject(card, 'p1')).toBe(true)
    expect(cardIsInProject(card, 'p2')).toBe(false)
  })

  it('has no uncategorized bucket, unlike spaces', () => {
    expect(cardIsInProject(note('c1', []), 'anything')).toBe(false)
  })
})

describe('cardProjects', () => {
  it('returns the projects a card is in, in project order', () => {
    const projects = [project('a'), project('b'), project('c')]
    expect(cardProjects(note('c1', ['c', 'a']), projects).map((p) => p.id)).toEqual(['a', 'c'])
  })

  it('ignores memberships whose project no longer exists', () => {
    expect(cardProjects(note('c1', ['gone']), [project('a')])).toEqual([])
  })
})

describe('projectDocs', () => {
  it('takes only notes filed into the project', () => {
    const cards = [note('n1', ['p1']), note('n2', ['p2']), image('i1', ['p1'])]
    expect(projectDocs(cards, 'p1').map((c) => c.id)).toEqual(['n1'])
  })

  it('puts the most recently edited first', () => {
    const cards = [
      note('old', ['p1'], '2026-01-01T00:00:00.000Z'),
      note('new', ['p1'], '2026-06-01T00:00:00.000Z'),
      note('mid', ['p1'], '2026-03-01T00:00:00.000Z'),
    ]
    expect(projectDocs(cards, 'p1').map((c) => c.id)).toEqual(['new', 'mid', 'old'])
  })

  it('returns nothing for a project with no notes', () => {
    expect(projectDocs([image('i1', ['p1'])], 'p1')).toEqual([])
  })
})

describe('project documents and the library', () => {
  const note = (over: Partial<Card> = {}) =>
    ({
      id: 'n',
      type: 'note',
      content: '',
      title: '',
      tags: [],
      spaceIds: [],
      projectIds: [],
      subnotes: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      deletedAt: null,
      ...over,
    }) as Card

  it('treats a note written in the docs pane as a document', () => {
    expect(isProjectDoc(note({ isDoc: true, projectIds: ['p1'] }))).toBe(true)
  })

  /*
   * The bug this replaced a heuristic for. An empty spaceIds does not mean
   * "belongs nowhere", it is how a card says it is in Uncategorized — so a note
   * captured from All cards while a project was selected looked exactly like a
   * document, and the library hid it. It saved; it just could not be found.
   */
  it('keeps a note captured into a project, even with no space of its own', () => {
    const captured = note({ projectIds: ['p1'], spaceIds: [] })
    expect(isProjectDoc(captured)).toBe(false)
    expect(libraryCards([captured])).toHaveLength(1)
  })

  it('does not treat a loose note as a document', () => {
    expect(isProjectDoc(note())).toBe(false)
  })

  it('leaves non-notes alone however they are filed', () => {
    const image = { ...note({ projectIds: ['p1'] }), type: 'image', mediaIds: [] } as unknown as Card
    expect(isProjectDoc(image)).toBe(false)
  })

  it('drops only the documents from the library', () => {
    const cards = [
      note({ id: 'doc', isDoc: true, projectIds: ['p1'] }),
      note({ id: 'captured', projectIds: ['p1'] }),
      note({ id: 'filed', projectIds: ['p1'], spaceIds: ['s1'] }),
      note({ id: 'loose' }),
    ]
    expect(libraryCards(cards).map((c) => c.id)).toEqual(['captured', 'filed', 'loose'])
  })

  it('still lists a document in its own project', () => {
    const doc = note({ id: 'doc', isDoc: true, projectIds: ['p1'] })
    expect(projectDocs([doc], 'p1').map((c) => c.id)).toEqual(['doc'])
  })
})
