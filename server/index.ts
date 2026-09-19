import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CARDS_FILE,
  EMBEDDINGS_FILE,
  LAYOUTS_FILE,
  MEDIA_DIR,
  PROJECTS_FILE,
  SPACES_FILE,
  ensureStore,
  readJson,
  writeJson,
} from './storage.ts'
import { fetchArticle, fetchLinkPreview, fetchTweet, normalizeTweet } from './content.ts'
import { findRelated } from './related.ts'
import { searchCards } from './search.ts'
import { syncTextIndex } from './index-text.ts'
import { extractPostMedia } from './post-media.ts'
import { extractPdfText } from './pdf.ts'
import { AuthManager } from './auth.ts'

ensureStore()

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, 'dist')

type Row = Record<string, unknown> & { id: string }

const app = new Hono()
const api = new Hono()

/*
 * The gate wraps the whole app rather than a set of admin routes: unlike
 * mathieutuli.com this has no public half, so the built assets stay behind it
 * too and only the login page and its icon sit outside.
 *
 * Registered before /api and the SPA catch-all below, because Hono dispatches
 * in registration order.
 */
const auth = new AuthManager(process.env.NODE_ENV !== 'production')
const PUBLIC_PATHS = new Set(['/login', '/logout', '/favicon.svg'])

app.use('*', async (c, next) => {
  if (PUBLIC_PATHS.has(c.req.path)) return next()
  return auth.requireAuth(c, next)
})

app.get('/login', auth.loginPage)
app.post('/login', auth.loginSubmit)
app.get('/logout', auth.logout)

// ---------------------------------------------------------------- cards

api.get('/cards', (c) => c.json(readJson<Row[]>(CARDS_FILE, [])))

api.post('/cards', async (c) => {
  const card = await c.req.json()
  const cards = readJson<Row[]>(CARDS_FILE, [])
  cards.push(card)
  writeJson(CARDS_FILE, cards)
  return c.json(card)
})

api.post('/cards/bulk', async (c) => {
  const { cards: incoming = [] } = await c.req.json<{ cards: Row[] }>()
  const cards = readJson<Row[]>(CARDS_FILE, [])
  const ids = new Set(cards.map((x) => x.id))

  let imported = 0
  let skipped = 0
  for (const card of incoming) {
    if (ids.has(card.id)) {
      skipped++
      continue
    }
    cards.push(card)
    ids.add(card.id)
    imported++
  }

  writeJson(CARDS_FILE, cards)
  return c.json({ success: true, imported, skipped })
})

api.put('/cards/:id', async (c) => {
  const id = c.req.param('id')
  const changes = await c.req.json()
  const cards = readJson<Row[]>(CARDS_FILE, []).map((card) =>
    card.id === id ? { ...card, ...changes } : card
  )
  writeJson(CARDS_FILE, cards)
  return c.json({ success: true })
})

api.delete('/cards/:id', (c) => {
  const id = c.req.param('id')
  writeJson(
    CARDS_FILE,
    readJson<Row[]>(CARDS_FILE, []).filter((card) => card.id !== id)
  )
  fs.rmSync(path.join(MEDIA_DIR, id), { recursive: true, force: true })
  return c.json({ success: true })
})

// --------------------------------------------------------------- spaces

api.get('/spaces', (c) => c.json(readJson<Row[]>(SPACES_FILE, [])))

api.post('/spaces', async (c) => {
  const space = await c.req.json()
  const spaces = readJson<Row[]>(SPACES_FILE, [])
  spaces.push(space)
  writeJson(SPACES_FILE, spaces)
  return c.json(space)
})

api.post('/spaces/bulk', async (c) => {
  const { spaces: incoming = [] } = await c.req.json<{ spaces: Row[] }>()
  const spaces = readJson<Row[]>(SPACES_FILE, [])
  const ids = new Set(spaces.map((s) => s.id))

  let imported = 0
  for (const space of incoming) {
    if (ids.has(space.id)) continue
    spaces.push(space)
    ids.add(space.id)
    imported++
  }

  writeJson(SPACES_FILE, spaces)
  return c.json({ success: true, imported })
})

api.put('/spaces/:id', async (c) => {
  const id = c.req.param('id')
  const changes = await c.req.json()
  writeJson(
    SPACES_FILE,
    readJson<Row[]>(SPACES_FILE, []).map((s) => (s.id === id ? { ...s, ...changes } : s))
  )
  return c.json({ success: true })
})

api.delete('/spaces/:id', (c) => {
  const id = c.req.param('id')
  writeJson(
    SPACES_FILE,
    readJson<Row[]>(SPACES_FILE, []).filter((s) => s.id !== id)
  )
  return c.json({ success: true })
})

// ------------------------------------------------------------- projects

api.get('/projects', (c) => c.json(readJson<Row[]>(PROJECTS_FILE, [])))

api.post('/projects', async (c) => {
  const project = await c.req.json()
  const projects = readJson<Row[]>(PROJECTS_FILE, [])
  projects.push(project)
  writeJson(PROJECTS_FILE, projects)
  return c.json(project)
})

api.put('/projects/:id', async (c) => {
  const id = c.req.param('id')
  const changes = await c.req.json()
  writeJson(
    PROJECTS_FILE,
    readJson<Row[]>(PROJECTS_FILE, []).map((p) => (p.id === id ? { ...p, ...changes } : p))
  )
  return c.json({ success: true })
})

/**
 * Deleting a project drops its canvas with it — the layout is the project's
 * own arrangement, meaningless once the project is gone. The cards are not
 * touched; unfiling them is the client's job, same as spaces.
 */
api.delete('/projects/:id', (c) => {
  const id = c.req.param('id')
  writeJson(
    PROJECTS_FILE,
    readJson<Row[]>(PROJECTS_FILE, []).filter((p) => p.id !== id)
  )

  const layouts = readJson<Record<string, unknown>>(LAYOUTS_FILE, {})
  delete layouts[`project:${id}`]
  writeJson(LAYOUTS_FILE, layouts)

  return c.json({ success: true })
})

// -------------------------------------------------------------- layouts

api.get('/layouts', (c) => c.json(readJson(LAYOUTS_FILE, {})))

api.put('/layouts/:canvasKey', async (c) => {
  const canvasKey = c.req.param('canvasKey')
  const { positions = {}, removed = [] } = await c.req.json<{
    positions: Record<string, unknown>
    removed: string[]
  }>()

  const layouts = readJson<Record<string, Record<string, unknown>>>(LAYOUTS_FILE, {})
  layouts[canvasKey] = { ...(layouts[canvasKey] || {}), ...positions }
  for (const cardId of removed) delete layouts[canvasKey][cardId]

  writeJson(LAYOUTS_FILE, layouts)
  return c.json(layouts[canvasKey])
})

// ----------------------------------------------------------- embeddings

api.get('/embeddings', (c) => c.json(readJson(EMBEDDINGS_FILE, {})))

api.put('/embeddings', async (c) => {
  const { entries = {}, removed = [] } = await c.req.json<{
    entries: Record<string, unknown>
    removed: string[]
  }>()

  const stored = readJson<Record<string, unknown>>(EMBEDDINGS_FILE, {})
  Object.assign(stored, entries)
  for (const cardId of removed) delete stored[cardId]

  // Not writeJson: this file is ~1MB of base64 and pretty-printing it is waste.
  fs.writeFileSync(EMBEDDINGS_FILE, JSON.stringify(stored))
  return c.json({ count: Object.keys(stored).length })
})

// ---------------------------------------------------------------- media

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.jpg': 'image/jpeg',
  '.pdf': 'application/pdf',
}

let mediaSequence = 0

api.post('/media/:cardId', async (c) => {
  const cardId = c.req.param('cardId')
  const dir = path.join(MEDIA_DIR, cardId)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  const contentType = c.req.header('content-type') || 'application/octet-stream'
  const ext =
    Object.entries(MIME).find(([, mime]) => contentType.includes(mime.split('/')[1]))?.[0] ||
    (contentType.includes('video') ? '.mp4' : '.jpg')

  // A bare timestamp lets same-millisecond writes in a gallery upload clobber
  // each other, so the sequence disambiguates.
  const filename = `${Date.now()}-${String(mediaSequence++).padStart(6, '0')}${ext}`
  const body = Buffer.from(await c.req.arrayBuffer())
  fs.writeFileSync(path.join(dir, filename), body)

  // A PDF's words are its searchable content, and the client never sees them
  // — the text lands on the card here so the semantic index picks it up.
  // A document that won't parse still uploads; extraction is an enhancement.
  if (ext === '.pdf') {
    try {
      const { text, pageCount } = await extractPdfText(body)
      const cards = readJson<Row[]>(CARDS_FILE, [])
      const card = cards.find((x) => x.id === cardId)
      if (card) {
        card.extractedText = text
        card.pageCount = pageCount
        card.updatedAt = new Date().toISOString()
        writeJson(CARDS_FILE, cards)
      }
    } catch (error) {
      console.error(`pdf extraction failed for ${cardId}:`, (error as Error).message)
    }
  }

  return c.json({ filename, cardId })
})

api.get('/media/:cardId', (c) => {
  const cardId = c.req.param('cardId')
  const dir = path.join(MEDIA_DIR, cardId)
  if (!fs.existsSync(dir)) return c.json([])
  // Filenames are timestamp-ordered, so sorting keeps a gallery in order.
  return c.json(fs.readdirSync(dir).sort().map((f) => `/api/media/${cardId}/${f}`))
})

api.get('/media/:cardId/:filename', (c) => {
  const { cardId, filename } = c.req.param()
  // Both segments come from the URL; keep them from escaping MEDIA_DIR.
  const file = path.join(MEDIA_DIR, path.basename(cardId), path.basename(filename))
  if (!fs.existsSync(file)) return c.notFound()

  const stat = fs.statSync(file)
  const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream'
  const headers: Record<string, string> = {
    'Content-Type': type,
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Accept-Ranges': 'bytes',
    ETag: `"${stat.size}-${stat.mtimeMs}"`,
  }

  if (c.req.header('if-none-match') === headers.ETag) {
    return new Response(null, { status: 304, headers })
  }

  // Without range support the browser can't seek a video; it can only play
  // from the start of whatever it has buffered.
  const range = c.req.header('range')
  const match = range?.match(/bytes=(\d*)-(\d*)/)
  if (match) {
    const start = match[1] ? parseInt(match[1], 10) : 0
    const end = match[2] ? parseInt(match[2], 10) : stat.size - 1
    if (start >= stat.size || end >= stat.size || start > end) {
      return new Response(null, {
        status: 416,
        headers: { 'Content-Range': `bytes */${stat.size}` },
      })
    }
    return new Response(fs.readFileSync(file).subarray(start, end + 1), {
      status: 206,
      headers: {
        ...headers,
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Content-Length': String(end - start + 1),
      },
    })
  }

  return new Response(fs.readFileSync(file), {
    headers: { ...headers, 'Content-Length': String(stat.size) },
  })
})

// -------------------------------------------------------------- content

api.get('/tweet/:id', async (c) => {
  try {
    const tweet = await fetchTweet(c.req.param('id'))
    return c.json(tweet?.data ? { ...tweet, data: normalizeTweet(tweet.data) } : tweet)
  } catch (error) {
    return c.json({ error: (error as Error).message }, 502)
  }
})

api.get('/link-preview', async (c) => {
  const url = c.req.query('url')
  if (!url) return c.json({ error: 'Missing url parameter' }, 400)
  try {
    c.header('Cache-Control', 'public, max-age=86400')
    return c.json(await fetchLinkPreview(url))
  } catch (error) {
    return c.json({ error: (error as Error).message }, 502)
  }
})

api.get('/article', async (c) => {
  const url = c.req.query('url')
  if (!url) return c.json({ error: 'Missing url parameter' }, 400)
  try {
    c.header('Cache-Control', 'public, max-age=86400')
    return c.json(await fetchArticle(url))
  } catch (error) {
    return c.json({ error: (error as Error).message }, 502)
  }
})

// Same-library related lookup for the extension, which has no embedder of
// its own. The app uses its web worker instead.
api.post('/related', async (c) => {
  const { text, limit } = await c.req.json<{ text: string; limit?: number }>()
  if (!text) return c.json({ error: 'Missing text' }, 400)
  try {
    return c.json({ related: await findRelated(text, limit ?? 4) })
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500)
  }
})

// Fill in a card's article metadata after the fact. Extraction takes seconds
// — fetch, parse, readability — and the extension shouldn't make you wait for
// it just to save a link.
api.post('/cards/:id/enrich', async (c) => {
  const id = c.req.param('id')
  const { url } = await c.req.json<{ url: string }>()
  if (!url) return c.json({ error: 'Missing url' }, 400)

  try {
    const article = await fetchArticle(url)
    const cards = readJson<Row[]>(CARDS_FILE, [])
    const card = cards.find((x) => x.id === id)
    if (!card) return c.json({ error: 'No such card' }, 404)

    // Never clobber a title the user typed; only fill what's empty.
    if (!card.title && article.title) card.title = article.title
    if (!card.author && article.author) card.author = article.author
    if (!card.siteName && article.siteName) card.siteName = article.siteName
    if (!card.preview && (article.title || article.excerpt || article.image)) {
      card.preview = {
        title: article.title,
        description: article.excerpt,
        image: article.image,
        siteName: article.siteName,
      }
    }
    card.updatedAt = new Date().toISOString()

    writeJson(CARDS_FILE, cards)
    return c.json({ success: true })
  } catch (error) {
    return c.json({ error: (error as Error).message }, 502)
  }
})

// Resolve the media inside a post without saving anything, so the extension
// can show what it found and let you pick one card or several.
api.get('/post-media', async (c) => {
  const url = c.req.query('url')
  if (!url) return c.json({ error: 'Missing url' }, 400)
  try {
    const found = await extractPostMedia(url)
    return c.json(found ?? { source: 'page', media: [] })
  } catch (error) {
    return c.json({ error: (error as Error).message }, 502)
  }
})

api.post('/index', async (c) => {
  try {
    return c.json(await syncTextIndex())
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500)
  }
})

api.post('/search', async (c) => {
  const { query, limit } = await c.req.json<{ query: string; limit?: number }>()
  if (!query) return c.json({ hits: [] })
  try {
    return c.json({ hits: await searchCards(query, limit ?? 60) })
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500)
  }
})

api.post('/clear', (c) => {
  writeJson(CARDS_FILE, [])
  writeJson(LAYOUTS_FILE, {})
  fs.writeFileSync(EMBEDDINGS_FILE, '{}')
  fs.rmSync(MEDIA_DIR, { recursive: true, force: true })
  fs.mkdirSync(MEDIA_DIR, { recursive: true })
  return c.json({ success: true })
})

app.route('/api', api)

// Serve the built app when there is one, so `npm run build && npm run serve`
// gives a working app rather than a shell that 404s on /api/cards.
if (fs.existsSync(DIST)) {
  app.get('*', async (c) => {
    const requested = path.join(DIST, path.normalize(c.req.path).replace(/^(\.\.[/\\])+/, ''))
    const file = fs.existsSync(requested) && fs.statSync(requested).isFile()
      ? requested
      : path.join(DIST, 'index.html')
    if (!fs.existsSync(file)) return c.notFound()

    const ext = path.extname(file)
    const type =
      ext === '.html' ? 'text/html'
      : ext === '.js' ? 'text/javascript'
      : ext === '.css' ? 'text/css'
      : ext === '.svg' ? 'image/svg+xml'
      : MIME[ext] || 'application/octet-stream'

    return new Response(fs.readFileSync(file), { headers: { 'Content-Type': type } })
  })
}

const port = Number(process.env.PORT) || 3001

serve({ fetch: app.fetch, port, hostname: '127.0.0.1' }, (info) => {
  // Bound to loopback deliberately: Caddy terminates TLS and proxies in, so
  // nothing reaches this port except through the login gate in front of it.
  console.log(`cortexual api on http://127.0.0.1:${info.port}`)
})
