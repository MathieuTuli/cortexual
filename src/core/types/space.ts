import { z } from 'zod'

export const ViewModeEnum = z.enum(['grid', 'list'])
export type ViewMode = z.infer<typeof ViewModeEnum>

export const SpaceSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  viewMode: ViewModeEnum.optional(),
  isDefault: z.boolean(),
  sortOrder: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
})

export type Space = z.infer<typeof SpaceSchema>

export type CreateSpaceInput = Pick<Space, 'name'> & Partial<Pick<Space, 'description' | 'color' | 'icon'>>
export type UpdateSpaceInput = Partial<Pick<Space, 'name' | 'description' | 'color' | 'icon' | 'viewMode'>>

export const DEFAULT_SPACE_ID = 'uncategorized'

export const DEFAULT_SPACE: Space = {
  id: DEFAULT_SPACE_ID,
  name: 'Uncategorized',
  isDefault: true,
  sortOrder: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  deletedAt: null,
}
