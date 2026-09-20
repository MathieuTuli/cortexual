import { z } from 'zod'

export const SubnoteSchema = z.object({
  id: z.string(),
  content: z.string(),
  createdAt: z.string(),
})

export type Subnote = z.infer<typeof SubnoteSchema>

export const CardTypeEnum = z.enum(['note', 'image', 'video', 'link', 'highlight', 'pdf'])
export type CardType = z.infer<typeof CardTypeEnum>

export const CARD_TYPE_LABELS: Record<CardType, string> = {
  note: 'Notes',
  image: 'Images',
  video: 'Videos',
  link: 'Links',
  highlight: 'Highlights',
  pdf: 'PDFs',
}

export const CardBaseSchema = z.object({
  id: z.string(),
  /** Spaces this card belongs to. Empty means uncategorized. */
  spaceIds: z.array(z.string()),
  /**
   * Projects this card is part of. Independent of spaceIds — a project pulls
   * from wherever it likes, and filing a card into one doesn't move it.
   */
  projectIds: z.array(z.string()),
  type: CardTypeEnum,
  title: z.string().optional(),
  // Where the card came from, when it was captured from something else — a
  // highlight, a clipped article, an imported bookmark. Empty for cards you
  // wrote yourself.
  author: z.string().optional(),
  /**
   * A description generated from the image itself, for cards that arrived with
   * no title, caption or tags. Kept apart from the user's own fields so a
   * regenerate can never overwrite something you wrote.
   */
  autoCaption: z.string().optional(),
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
  /** Written in a project's docs pane, as opposed to captured into the library. */
  isDoc: z.boolean().optional(),
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

/**
 * Something someone else wrote, quoted verbatim. Distinct from a note: `text`
 * is not yours to rewrite, and the provenance on the base is the point of it.
 * `note` holds your own commentary alongside the quote.
 */
export const HighlightCardSchema = CardBaseSchema.extend({
  type: z.literal('highlight'),
  text: z.string(),
  note: z.string().optional(),
})

export const PdfCardSchema = CardBaseSchema.extend({
  type: z.literal('pdf'),
  /** The name the file arrived with; the stored copy is renamed on disk. */
  fileName: z.string(),
  pageCount: z.number().optional(),
  /**
   * Text the server pulled out of the document at upload. It exists for the
   * semantic index and the tile excerpt, not as a faithful copy — it's capped,
   * and the PDF itself remains the source of truth.
   */
  extractedText: z.string().optional(),
})

export const CardSchema = z.discriminatedUnion('type', [
  NoteCardSchema,
  ImageCardSchema,
  VideoCardSchema,
  LinkCardSchema,
  HighlightCardSchema,
  PdfCardSchema,
])

export type CardBase = z.infer<typeof CardBaseSchema>
export type NoteCard = z.infer<typeof NoteCardSchema>
export type ImageCard = z.infer<typeof ImageCardSchema>
export type VideoCard = z.infer<typeof VideoCardSchema>
export type LinkCard = z.infer<typeof LinkCardSchema>
export type HighlightCard = z.infer<typeof HighlightCardSchema>
export type PdfCard = z.infer<typeof PdfCardSchema>
export type Card = z.infer<typeof CardSchema>
export type LinkPreview = z.infer<typeof LinkPreviewSchema>

export type CreateNoteCardInput = Omit<NoteCard, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>
export type CreateImageCardInput = Omit<ImageCard, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>
export type CreateVideoCardInput = Omit<VideoCard, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>
export type CreateLinkCardInput = Omit<LinkCard, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>
export type CreateHighlightCardInput = Omit<HighlightCard, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>
export type CreatePdfCardInput = Omit<PdfCard, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>
export type CreateCardInput =
  | CreateNoteCardInput
  | CreateImageCardInput
  | CreateVideoCardInput
  | CreateLinkCardInput
  | CreateHighlightCardInput
  | CreatePdfCardInput

/**
 * Distributed over the union on purpose. `Omit<Card, …>` collapses to the keys
 * every card shares, which silently made `content`, `text` and `caption`
 * unpatchable — callers were casting around it one by one.
 */
type CardPatch<T> = T extends unknown ? Partial<Omit<T, 'id' | 'createdAt' | 'type'>> : never
export type UpdateCardInput = CardPatch<Card>
