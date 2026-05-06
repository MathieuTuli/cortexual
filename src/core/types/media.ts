import { z } from 'zod'

export const MediaSchema = z.object({
  id: z.string(),
  cardId: z.string(),
  type: z.enum(['image', 'video']),
  mimeType: z.string(),
  size: z.number(),
  createdAt: z.string(),
})

export type Media = z.infer<typeof MediaSchema>

export interface MediaWithBlob extends Media {
  blob: Blob
}
