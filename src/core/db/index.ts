import Dexie, { type Table } from 'dexie'
import type { Card, Space, MediaWithBlob } from '../types'

export class CortexualDB extends Dexie {
  cards!: Table<Card>
  spaces!: Table<Space>
  media!: Table<MediaWithBlob>

  constructor() {
    super('cortexual')

    // Version 1: Original schema
    this.version(1).stores({
      cards: 'id, spaceId, type, createdAt, updatedAt, deletedAt, *tags',
      spaces: 'id, name, sortOrder, isDefault, deletedAt',
      media: 'id, cardId, type',
    })

    // Version 2: Migrate image cards from mediaId to mediaIds
    this.version(2).stores({
      cards: 'id, spaceId, type, createdAt, updatedAt, deletedAt, *tags',
      spaces: 'id, name, sortOrder, isDefault, deletedAt',
      media: 'id, cardId, type',
    }).upgrade(tx => {
      return tx.table('cards').toCollection().modify(card => {
        // Migrate image cards from mediaId to mediaIds
        if (card.type === 'image') {
          if ('mediaId' in card && !('mediaIds' in card)) {
            card.mediaIds = card.mediaId ? [card.mediaId] : []
            delete card.mediaId
          }
          // Migrate thumbnailDataUrl to thumbnailDataUrls
          if ('thumbnailDataUrl' in card && !('thumbnailDataUrls' in card)) {
            card.thumbnailDataUrls = card.thumbnailDataUrl ? [card.thumbnailDataUrl] : []
            delete card.thumbnailDataUrl
          }
        }
      })
    })
  }
}

export const db = new CortexualDB()
