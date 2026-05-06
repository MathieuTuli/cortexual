// API client for file-based storage
const API_BASE = '/api'

export const api = {
  // Cards
  async getCards() {
    const res = await fetch(`${API_BASE}/cards`)
    return res.json()
  },

  async createCard(card: any) {
    const res = await fetch(`${API_BASE}/cards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(card),
    })
    return res.json()
  },

  async updateCard(id: string, changes: any) {
    const res = await fetch(`${API_BASE}/cards/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(changes),
    })
    return res.json()
  },

  async deleteCard(id: string) {
    const res = await fetch(`${API_BASE}/cards/${id}`, {
      method: 'DELETE',
    })
    return res.json()
  },

  async createCardsBulk(cards: any[]): Promise<{ success: boolean; imported: number; skipped: number }> {
    const res = await fetch(`${API_BASE}/cards/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cards }),
    })
    if (!res.ok) {
      throw new Error(`Bulk card import failed: ${res.status}`)
    }
    return res.json()
  },

  // Spaces
  async getSpaces() {
    const res = await fetch(`${API_BASE}/spaces`)
    return res.json()
  },

  async createSpace(space: any) {
    const res = await fetch(`${API_BASE}/spaces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(space),
    })
    return res.json()
  },

  async updateSpace(id: string, changes: any) {
    const res = await fetch(`${API_BASE}/spaces/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(changes),
    })
    return res.json()
  },

  async deleteSpace(id: string) {
    const res = await fetch(`${API_BASE}/spaces/${id}`, {
      method: 'DELETE',
    })
    return res.json()
  },

  async createSpacesBulk(spaces: any[]): Promise<{ success: boolean; imported: number }> {
    const res = await fetch(`${API_BASE}/spaces/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spaces }),
    })
    if (!res.ok) {
      throw new Error(`Bulk space import failed: ${res.status}`)
    }
    return res.json()
  },

  // Media
  async uploadMedia(cardId: string, blob: Blob) {
    const res = await fetch(`${API_BASE}/media/${cardId}`, {
      method: 'POST',
      headers: { 'Content-Type': blob.type },
      body: blob,
    })
    return res.json()
  },

  async getMediaUrls(cardId: string): Promise<string[]> {
    const res = await fetch(`${API_BASE}/media/${cardId}`)
    return res.json()
  },
}
