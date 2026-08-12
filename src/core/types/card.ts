import { z } from 'zod'

export const SubnoteSchema = z.object({
  id: z.string(),
  content: z.string(),
  createdAt: z.string(),
})

export type Subnote = z.infer<typeof SubnoteSchema>

export const CardTypeEnum = z.enum(['note', 'image', 'video', 'link'])
export type CardType = z.infer<typeof CardTypeEnum>

export const CardBaseSchema = z.object({
  id: z.string(),
  /** Spaces this card belongs to. Empty means uncategorized. */
  spaceIds: z.array(z.string()),
  type: CardTypeEnum,
  title: z.string().optional(),
  // Where the card came from, when it was captured from something else — a
  // highlight, a clipped article, an imported bookmark. Empty for cards you
  // wrote yourself.
  author: z.string().optional(),
  sourceUrl: z.string().optional(),
  siteName: z.string().optional(),
  tags: z.array(z.string()),
  subnotes: z.array(SubnoteSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
})

export const NoteCardSchema = CardBaseSchema.extend({
  type: z.literal('note'),
  content: z.string(),
})

export const ImageCardSchema = CardBaseSchema.extend({
  type: z.literal('image'),
  mediaIds: z.array(z.string()),
  caption: z.string().optional(),
  thumbnailDataUrls: z.array(z.string()).optional(),
})

export const VideoCardSchema = CardBaseSchema.extend({
  type: z.literal('video'),
  mediaId: z.string(),
  caption: z.string().optional(),
  thumbnailDataUrl: z.string().optional(),
  duration: z.number().optional(),
})

export const EmbedTypeEnum = z.enum(['youtube', 'twitter', 'generic'])
export type EmbedType = z.infer<typeof EmbedTypeEnum>

export const LinkPreviewSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  image: z.string().optional(),
  siteName: z.string().optional(),
})

export const LinkCardSchema = CardBaseSchema.extend({
  type: z.literal('link'),
  url: z.string().url(),
  embedType: EmbedTypeEnum.optional(),
  embedData: z.record(z.unknown()).optional(),
  preview: LinkPreviewSchema.optional(),
})

export const CardSchema = z.discriminatedUnion('type', [
  NoteCardSchema,
  ImageCardSchema,
  VideoCardSchema,
  LinkCardSchema,
])

export type CardBase = z.infer<typeof CardBaseSchema>
export type NoteCard = z.infer<typeof NoteCardSchema>
export type ImageCard = z.infer<typeof ImageCardSchema>
export type VideoCard = z.infer<typeof VideoCardSchema>
export type LinkCard = z.infer<typeof LinkCardSchema>
export type Card = z.infer<typeof CardSchema>
export type LinkPreview = z.infer<typeof LinkPreviewSchema>

export type CreateNoteCardInput = Omit<NoteCard, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>
export type CreateImageCardInput = Omit<ImageCard, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>
export type CreateVideoCardInput = Omit<VideoCard, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>
export type CreateLinkCardInput = Omit<LinkCard, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>
export type CreateCardInput = CreateNoteCardInput | CreateImageCardInput | CreateVideoCardInput | CreateLinkCardInput

export type UpdateCardInput = Partial<Omit<Card, 'id' | 'createdAt' | 'type'>>
