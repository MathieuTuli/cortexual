import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

const DATA_DIR = path.resolve(__dirname, 'data')
const CARDS_FILE = path.join(DATA_DIR, 'cards.json')
const SPACES_FILE = path.join(DATA_DIR, 'spaces.json')
const MEDIA_DIR = path.join(DATA_DIR, 'media')

// Ensure data directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true })

// Initialize files if they don't exist
if (!fs.existsSync(CARDS_FILE)) fs.writeFileSync(CARDS_FILE, '[]')
if (!fs.existsSync(SPACES_FILE)) {
  fs.writeFileSync(SPACES_FILE, JSON.stringify([
    { id: 'default', name: 'General', icon: '📚', color: '#0066cc', sortOrder: 0, isDefault: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), deletedAt: null }
  ]))
}

function fileStoragePlugin() {
  return {
    name: 'file-storage',
    configureServer(server: any) {
      // Parse JSON body (skip media uploads - they need raw binary body)
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (req.url?.startsWith('/api/') && !req.url?.startsWith('/api/media/') && (req.method === 'POST' || req.method === 'PUT')) {
          let body = ''
          req.on('data', (chunk: any) => body += chunk)
          await new Promise(resolve => req.on('end', resolve))
          try {
            req.body = JSON.parse(body)
          } catch {
            req.body = {}
          }
        }
        next()
      })

      // GET /api/cards
      server.middlewares.use((req: any, res: any, next: any) => {
        if (req.url === '/api/cards' && req.method === 'GET') {
          const cards = JSON.parse(fs.readFileSync(CARDS_FILE, 'utf-8'))
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(cards))
          return
        }
        next()
      })

      // POST /api/cards
      server.middlewares.use((req: any, res: any, next: any) => {
        if (req.url === '/api/cards' && req.method === 'POST') {
          const cards = JSON.parse(fs.readFileSync(CARDS_FILE, 'utf-8'))
          cards.push(req.body)
          fs.writeFileSync(CARDS_FILE, JSON.stringify(cards, null, 2))
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(req.body))
          return
        }
        next()
      })

      // POST /api/cards/bulk - bulk import cards (prevents race conditions)
      server.middlewares.use((req: any, res: any, next: any) => {
        if (req.url === '/api/cards/bulk' && req.method === 'POST') {
          const existingCards = JSON.parse(fs.readFileSync(CARDS_FILE, 'utf-8'))
          const newCards = req.body.cards || []
          const existingIds = new Set(existingCards.map((c: any) => c.id))

          let imported = 0
          let skipped = 0

          for (const card of newCards) {
            if (!existingIds.has(card.id)) {
              existingCards.push(card)
              existingIds.add(card.id)
              imported++
            } else {
              skipped++
            }
          }

          fs.writeFileSync(CARDS_FILE, JSON.stringify(existingCards, null, 2))
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ success: true, imported, skipped }))
          return
        }
        next()
      })

      // PUT /api/cards/:id
      server.middlewares.use((req: any, res: any, next: any) => {
        const match = req.url?.match(/^\/api\/cards\/([^/]+)$/)
        if (match && req.method === 'PUT') {
          const id = match[1]
          let cards = JSON.parse(fs.readFileSync(CARDS_FILE, 'utf-8'))
          cards = cards.map((c: any) => c.id === id ? { ...c, ...req.body } : c)
          fs.writeFileSync(CARDS_FILE, JSON.stringify(cards, null, 2))
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ success: true }))
          return
        }
        next()
      })

      // DELETE /api/cards/:id
      server.middlewares.use((req: any, res: any, next: any) => {
        const match = req.url?.match(/^\/api\/cards\/([^/]+)$/)
        if (match && req.method === 'DELETE') {
          const id = match[1]
          let cards = JSON.parse(fs.readFileSync(CARDS_FILE, 'utf-8'))
          cards = cards.filter((c: any) => c.id !== id)
          fs.writeFileSync(CARDS_FILE, JSON.stringify(cards, null, 2))
          // Also delete media
          const mediaPath = path.join(MEDIA_DIR, id)
          if (fs.existsSync(mediaPath)) {
            fs.rmSync(mediaPath, { recursive: true })
          }
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ success: true }))
          return
        }
        next()
      })

      // GET /api/spaces
      server.middlewares.use((req: any, res: any, next: any) => {
        if (req.url === '/api/spaces' && req.method === 'GET') {
          const spaces = JSON.parse(fs.readFileSync(SPACES_FILE, 'utf-8'))
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(spaces))
          return
        }
        next()
      })

      // POST /api/spaces
      server.middlewares.use((req: any, res: any, next: any) => {
        if (req.url === '/api/spaces' && req.method === 'POST') {
          const spaces = JSON.parse(fs.readFileSync(SPACES_FILE, 'utf-8'))
          spaces.push(req.body)
          fs.writeFileSync(SPACES_FILE, JSON.stringify(spaces, null, 2))
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(req.body))
          return
        }
        next()
      })

      // POST /api/spaces/bulk - bulk import spaces (prevents race conditions)
      server.middlewares.use((req: any, res: any, next: any) => {
        if (req.url === '/api/spaces/bulk' && req.method === 'POST') {
          const existingSpaces = JSON.parse(fs.readFileSync(SPACES_FILE, 'utf-8'))
          const newSpaces = req.body.spaces || []
          const existingIds = new Set(existingSpaces.map((s: any) => s.id))

          let imported = 0
          for (const space of newSpaces) {
            if (!existingIds.has(space.id)) {
              existingSpaces.push(space)
              existingIds.add(space.id)
              imported++
            }
          }

          fs.writeFileSync(SPACES_FILE, JSON.stringify(existingSpaces, null, 2))
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ success: true, imported }))
          return
        }
        next()
      })

      // PUT /api/spaces/:id
      server.middlewares.use((req: any, res: any, next: any) => {
        const match = req.url?.match(/^\/api\/spaces\/([^/]+)$/)
        if (match && req.method === 'PUT') {
          const id = match[1]
          let spaces = JSON.parse(fs.readFileSync(SPACES_FILE, 'utf-8'))
          spaces = spaces.map((s: any) => s.id === id ? { ...s, ...req.body } : s)
          fs.writeFileSync(SPACES_FILE, JSON.stringify(spaces, null, 2))
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ success: true }))
          return
        }
        next()
      })

      // DELETE /api/spaces/:id
      server.middlewares.use((req: any, res: any, next: any) => {
        const match = req.url?.match(/^\/api\/spaces\/([^/]+)$/)
        if (match && req.method === 'DELETE') {
          const id = match[1]
          let spaces = JSON.parse(fs.readFileSync(SPACES_FILE, 'utf-8'))
          spaces = spaces.filter((s: any) => s.id !== id)
          fs.writeFileSync(SPACES_FILE, JSON.stringify(spaces, null, 2))
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ success: true }))
          return
        }
        next()
      })

      // POST /api/media/:cardId - upload media
      server.middlewares.use((req: any, res: any, next: any) => {
        const match = req.url?.match(/^\/api\/media\/([^/]+)$/)
        if (match && req.method === 'POST') {
          const cardId = match[1]
          const cardMediaDir = path.join(MEDIA_DIR, cardId)
          if (!fs.existsSync(cardMediaDir)) fs.mkdirSync(cardMediaDir, { recursive: true })

          const chunks: Buffer[] = []
          req.on('data', (chunk: Buffer) => chunks.push(chunk))
          req.on('end', () => {
            const buffer = Buffer.concat(chunks)
            const contentType = req.headers['content-type'] || 'application/octet-stream'
            const ext = contentType.includes('png') ? '.png' : contentType.includes('gif') ? '.gif' : contentType.includes('webp') ? '.webp' : contentType.includes('video') ? '.mp4' : '.jpg'
            const filename = `${Date.now()}${ext}`
            fs.writeFileSync(path.join(cardMediaDir, filename), buffer)
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ filename, cardId }))
          })
          return
        }
        next()
      })

      // GET /api/media/:cardId - list media for card
      server.middlewares.use((req: any, res: any, next: any) => {
        const match = req.url?.match(/^\/api\/media\/([^/]+)$/)
        if (match && req.method === 'GET') {
          const cardId = match[1]
          const cardMediaDir = path.join(MEDIA_DIR, cardId)
          if (fs.existsSync(cardMediaDir)) {
            const files = fs.readdirSync(cardMediaDir)
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(files.map(f => `/api/media/${cardId}/${f}`)))
          } else {
            res.setHeader('Content-Type', 'application/json')
            res.end('[]')
          }
          return
        }
        next()
      })

      // GET /api/media/:cardId/:filename - serve media file
      server.middlewares.use((req: any, res: any, next: any) => {
        const match = req.url?.match(/^\/api\/media\/([^/]+)\/([^/]+)$/)
        if (match && req.method === 'GET') {
          const [, cardId, filename] = match
          const filePath = path.join(MEDIA_DIR, cardId, filename)
          if (fs.existsSync(filePath)) {
            const ext = path.extname(filename).toLowerCase()
            const contentType = ext === '.png' ? 'image/png' : ext === '.gif' ? 'image/gif' : ext === '.webp' ? 'image/webp' : ext === '.mp4' ? 'video/mp4' : 'image/jpeg'
            res.setHeader('Content-Type', contentType)
            res.end(fs.readFileSync(filePath))
            return
          }
        }
        next()
      })

      // POST /api/clear - clear all cards and media
      server.middlewares.use((req: any, res: any, next: any) => {
        if (req.url === '/api/clear' && req.method === 'POST') {
          // Clear cards file
          fs.writeFileSync(CARDS_FILE, '[]')
          // Clear all media directories
          if (fs.existsSync(MEDIA_DIR)) {
            const mediaDirs = fs.readdirSync(MEDIA_DIR)
            for (const dir of mediaDirs) {
              const dirPath = path.join(MEDIA_DIR, dir)
              if (fs.statSync(dirPath).isDirectory()) {
                fs.rmSync(dirPath, { recursive: true })
              }
            }
          }
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ success: true }))
          return
        }
        next()
      })
    }
  }
}

export default defineConfig({
  plugins: [react(), fileStoragePlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
