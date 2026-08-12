import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'
import { fetchTweet } from 'react-tweet/api'
import { ProxyAgent, fetch as undiciFetch, setGlobalDispatcher } from 'undici'

const PROXY_URL =
  process.env.HTTPS_PROXY ||
  process.env.https_proxy ||
  process.env.HTTP_PROXY ||
  process.env.http_proxy
if (PROXY_URL) {
  setGlobalDispatcher(new ProxyAgent(PROXY_URL))
}

const DATA_DIR = path.resolve(__dirname, 'data')
const CARDS_FILE = path.join(DATA_DIR, 'cards.json')
const SPACES_FILE = path.join(DATA_DIR, 'spaces.json')
const LAYOUTS_FILE = path.join(DATA_DIR, 'layouts.json')
const EMBEDDINGS_FILE = path.join(DATA_DIR, 'embeddings.json')
const MEDIA_DIR = path.join(DATA_DIR, 'media')

// Ensure data directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true })

// Initialize files if they don't exist
if (!fs.existsSync(CARDS_FILE)) fs.writeFileSync(CARDS_FILE, '[]')
if (!fs.existsSync(LAYOUTS_FILE)) fs.writeFileSync(LAYOUTS_FILE, '{}')
if (!fs.existsSync(EMBEDDINGS_FILE)) fs.writeFileSync(EMBEDDINGS_FILE, '{}')
if (!fs.existsSync(SPACES_FILE)) {
  fs.writeFileSync(SPACES_FILE, JSON.stringify([
    { id: 'default', name: 'General', icon: '📚', color: '#0066cc', sortOrder: 0, isDefault: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), deletedAt: null }
  ]))
}

interface LinkPreview {
  title?: string
  description?: string
  image?: string
  siteName?: string
}

// X's syndication API omits empty entity arrays, but react-tweet's enrichTweet
// iterates them unconditionally and throws "entities is not iterable".
function normalizeTweet(tweet: any): any {
  if (!tweet || typeof tweet !== 'object') return tweet
  const e = tweet.entities ?? {}
  tweet.entities = {
    ...e,
    hashtags: Array.isArray(e.hashtags) ? e.hashtags : [],
    user_mentions: Array.isArray(e.user_mentions) ? e.user_mentions : [],
    urls: Array.isArray(e.urls) ? e.urls : [],
    symbols: Array.isArray(e.symbols) ? e.symbols : [],
  }
  if (tweet.quoted_tweet) tweet.quoted_tweet = normalizeTweet(tweet.quoted_tweet)
  return tweet
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

function pickMeta(html: string, names: string[]): string | undefined {
  for (const name of names) {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${name}["'][^>]*>`,
      'i',
    )
    const tag = html.match(re)?.[0]
    if (!tag) continue
    const content = tag.match(/content=["']([^"']*)["']/i)?.[1]
    if (content) return decodeEntities(content)
  }
  return undefined
}

// YouTube serves a consent/JS shell to bots, so its watch pages carry no
// scrapable og:title. oEmbed hands it over without auth.
async function fetchYouTubeOEmbed(url: string): Promise<LinkPreview | null> {
  const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
  const res = await undiciFetch(endpoint, { redirect: 'follow' })
  if (!res.ok) return null
  const data = (await res.json()) as { title?: string; author_name?: string; thumbnail_url?: string }
  if (!data.title) return null
  return {
    title: data.title,
    description: data.author_name,
    image: data.thumbnail_url,
    siteName: 'YouTube',
  }
}

async function fetchLinkPreview(url: string): Promise<LinkPreview> {
  const hostname = new URL(url).hostname.replace(/^www\./, '')
  if (hostname === 'youtube.com' || hostname === 'youtu.be' || hostname === 'm.youtube.com') {
    const oembed = await fetchYouTubeOEmbed(url).catch(() => null)
    if (oembed) return oembed
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await undiciFetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; CortexualBot/1.0; +https://cortexual.local)',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const contentType = res.headers.get('content-type') || ''
    if (!contentType.includes('text/html')) {
      return {}
    }
    const html = (await res.text()).slice(0, 500_000)

    const title =
      pickMeta(html, ['og:title', 'twitter:title']) ||
      decodeEntities(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || '') ||
      undefined
    const description = pickMeta(html, [
      'og:description',
      'twitter:description',
      'description',
    ])
    let image = pickMeta(html, ['og:image', 'og:image:url', 'twitter:image', 'twitter:image:src'])
    const siteName = pickMeta(html, ['og:site_name', 'application-name']) ||
      new URL(url).hostname.replace(/^www\./, '')

    if (image) {
      try {
        image = new URL(image, url).toString()
      } catch {
        image = undefined
      }
    }

    return { title, description, image, siteName }
  } finally {
    clearTimeout(timeout)
  }
}

let mediaSequence = 0

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

      // GET /api/embeddings - cardId -> { hash, vector }
      server.middlewares.use((req: any, res: any, next: any) => {
        if (req.url === '/api/embeddings' && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json')
          res.end(fs.readFileSync(EMBEDDINGS_FILE, 'utf-8'))
          return
        }
        next()
      })

      // PUT /api/embeddings - merge a batch in, drop ids listed in `removed`
      server.middlewares.use((req: any, res: any, next: any) => {
        if (req.url === '/api/embeddings' && req.method === 'PUT') {
          const stored = JSON.parse(fs.readFileSync(EMBEDDINGS_FILE, 'utf-8'))
          Object.assign(stored, req.body?.entries || {})
          for (const cardId of req.body?.removed || []) delete stored[cardId]
          fs.writeFileSync(EMBEDDINGS_FILE, JSON.stringify(stored))
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ count: Object.keys(stored).length }))
          return
        }
        next()
      })

      // GET /api/layouts - every space's canvas positions
      server.middlewares.use((req: any, res: any, next: any) => {
        if (req.url === '/api/layouts' && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json')
          res.end(fs.readFileSync(LAYOUTS_FILE, 'utf-8'))
          return
        }
        next()
      })

      // PUT /api/layouts/:spaceKey - merge positions into one space's layout.
      // Merged rather than replaced so a drag only has to send what it moved.
      server.middlewares.use((req: any, res: any, next: any) => {
        const match = req.url?.match(/^\/api\/layouts\/([^/]+)$/)
        if (match && req.method === 'PUT') {
          const spaceKey = decodeURIComponent(match[1])
          const layouts = JSON.parse(fs.readFileSync(LAYOUTS_FILE, 'utf-8'))
          const positions = req.body?.positions || {}
          const removed: string[] = req.body?.removed || []

          layouts[spaceKey] = { ...(layouts[spaceKey] || {}), ...positions }
          for (const cardId of removed) delete layouts[spaceKey][cardId]

          fs.writeFileSync(LAYOUTS_FILE, JSON.stringify(layouts, null, 2))
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(layouts[spaceKey]))
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
            // Uploading a gallery pushes several blobs at one card back to
            // back; a bare timestamp lets same-millisecond writes clobber
            // each other.
            const filename = `${Date.now()}-${String(mediaSequence++).padStart(6, '0')}${ext}`
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
            // Filenames are timestamp-ordered, so sorting keeps a gallery in
            // the order its images were added.
            const files = fs.readdirSync(cardMediaDir).sort()
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

      // GET /api/tweet/:id - proxy to Twitter syndication CDN for react-tweet
      server.middlewares.use(async (req: any, res: any, next: any) => {
        const match = req.url?.match(/^\/api\/tweet\/(\d+)$/)
        if (match && req.method === 'GET') {
          const id = match[1]
          try {
            const tweet = await fetchTweet(id)
            if (tweet?.data) tweet.data = normalizeTweet(tweet.data)
            res.setHeader('Content-Type', 'application/json')
            res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400')
            res.end(JSON.stringify(tweet))
          } catch (err: any) {
            res.statusCode = err?.status || 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: err?.message || 'Failed to fetch tweet' }))
          }
          return
        }
        next()
      })

      // GET /api/link-preview?url=... - fetch and parse OG/Twitter meta tags
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (req.url?.startsWith('/api/link-preview') && req.method === 'GET') {
          const url = new URL(req.url, 'http://localhost').searchParams.get('url')
          if (!url) {
            res.statusCode = 400
            res.end(JSON.stringify({ error: 'Missing url parameter' }))
            return
          }
          try {
            const preview = await fetchLinkPreview(url)
            res.setHeader('Content-Type', 'application/json')
            res.setHeader('Cache-Control', 'public, max-age=86400')
            res.end(JSON.stringify(preview))
          } catch (err: any) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: err?.message || 'Failed to fetch preview' }))
          }
          return
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
