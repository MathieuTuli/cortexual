/*
 * A single-admin login gate: one password (from the ADMIN_PASSWORD env var)
 * exchanged for an HMAC-signed session cookie.
 *
 * Ported from the Go original in ~/apps/mathieutuli (internal/auth/session.go),
 * keeping the same cookie name, token layout and TTL. It differs in what it
 * guards: mathieutuli.com is a public site with a few admin routes behind the
 * gate, whereas this is a private notebook, so everything is behind it and only
 * the login page itself is public.
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import type { Context, Next } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { Limiter } from './ratelimit.ts'

const COOKIE_NAME = 'admin_session'
const TTL_MS = 30 * 24 * 60 * 60 * 1000

export class AuthManager {
  private password: string
  private key: Buffer
  private secure: boolean
  private login = new Limiter(5, 15 * 60_000, 15 * 60_000)

  /**
   * Reads ADMIN_PASSWORD and derives the cookie-signing key from SESSION_SECRET
   * (or the password itself when SESSION_SECRET is unset), so that changing the
   * password invalidates existing sessions.
   */
  constructor(devMode: boolean) {
    this.password = process.env.ADMIN_PASSWORD ?? ''
    const secret = process.env.SESSION_SECRET || 'session:' + this.password
    this.key = createHash('sha256').update(secret).digest()
    this.secure = !devMode
  }

  configured(): boolean {
    return this.password !== ''
  }

  /*
   * Compares digests rather than the raw strings: timingSafeEqual throws on a
   * length mismatch, and hashing first keeps both sides 32 bytes so the
   * comparison neither throws nor leaks the password's length.
   */
  private passwordOK(pw: string): boolean {
    if (!this.password) return false
    const a = createHash('sha256').update(pw).digest()
    const b = createHash('sha256').update(this.password).digest()
    return timingSafeEqual(a, b)
  }

  /** Returns base64url(expiry[8] || HMAC-SHA256(expiry)). */
  private issue(expUnix: number): string {
    const buf = Buffer.alloc(8)
    buf.writeBigUInt64BE(BigInt(expUnix))
    const mac = createHmac('sha256', this.key).update(buf).digest()
    return Buffer.concat([buf, mac]).toString('base64url')
  }

  private verify(token: string): boolean {
    let raw: Buffer
    try {
      raw = Buffer.from(token, 'base64url')
    } catch {
      return false
    }
    if (raw.length !== 8 + 32) return false
    const mac = createHmac('sha256', this.key).update(raw.subarray(0, 8)).digest()
    if (!timingSafeEqual(raw.subarray(8), mac)) return false
    return Date.now() / 1000 < Number(raw.readBigUInt64BE(0))
  }

  loggedIn(c: Context): boolean {
    const ck = getCookie(c, COOKIE_NAME)
    return !!ck && this.verify(ck)
  }

  private setSession(c: Context): void {
    const exp = new Date(Date.now() + TTL_MS)
    setCookie(c, COOKIE_NAME, this.issue(Math.floor(exp.getTime() / 1000)), {
      path: '/',
      expires: exp,
      httpOnly: true,
      secure: this.secure,
      sameSite: 'Lax',
    })
  }

  /** Behind Caddy the socket is always loopback, so trust its forwarded header. */
  private clientIP(c: Context): string {
    const fwd = c.req.header('x-forwarded-for')
    return fwd ? fwd.split(',')[0].trim() : 'local'
  }

  /*
   * Unauthenticated API calls get a 401 rather than the login page: the SPA
   * fetches these, and a 302 to HTML would surface as a JSON parse error.
   */
  requireAuth = async (c: Context, next: Next) => {
    if (this.loggedIn(c)) return next()
    if (c.req.path.startsWith('/api/')) {
      return c.json({ error: 'unauthorized' }, 401)
    }
    return c.redirect('/login?next=' + encodeURIComponent(c.req.path), 302)
  }

  loginPage = (c: Context) => {
    if (this.loggedIn(c)) return c.redirect(safeNext(c.req.query('next')), 302)
    const err = this.configured() ? '' : 'Login is not configured (set ADMIN_PASSWORD).'
    return c.html(loginHTML(c.req.query('next') ?? '', err), err ? 500 : 200)
  }

  loginSubmit = async (c: Context) => {
    const form = await c.req.parseBody()
    const next = typeof form.next === 'string' ? form.next : ''
    const pw = typeof form.password === 'string' ? form.password : ''
    const ip = this.clientIP(c)

    const wait = this.login.retryAfter(ip)
    if (wait > 0) {
      c.header('Retry-After', String(Math.ceil(wait / 1000)))
      return c.html(loginHTML(next, `Too many attempts. Try again in ${humanWait(wait)}.`), 429)
    }
    if (!this.passwordOK(pw)) {
      this.login.fail(ip)
      return c.html(loginHTML(next, 'Incorrect password.'), 401)
    }
    this.login.reset(ip)
    this.setSession(c)
    return c.redirect(safeNext(next), 302)
  }

  logout = (c: Context) => {
    deleteCookie(c, COOKIE_NAME, { path: '/' })
    return c.redirect('/login', 302)
  }
}

function humanWait(ms: number): string {
  if (ms < 60_000) return `${Math.ceil(ms / 1000)} seconds`
  return `${Math.ceil(ms / 60_000)} minutes`
}

/** Keeps redirects on-site (no open redirects). */
export function safeNext(n: string | undefined): string {
  if (!n || !n.startsWith('/') || n.startsWith('//')) return '/'
  return n
}

const escapeHTML = (s: string) =>
  s.replace(/[&<>"']/g, (ch) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!,
  )

/*
 * Self-contained on purpose: the gate covers the built assets too, so the login
 * page cannot pull the app's stylesheet or fonts. The tokens below are copied
 * from src/index.css rather than imported, for that reason.
 */
function loginHTML(next: string, error: string): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex, nofollow" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <title>Cortexual</title>
    <style>
      :root { --bg:#fcfcfc; --card:#e5e5e5; --text:#000; --muted:#89827e; --accent:#1702fc; --danger:#d92b2b; }
      * { box-sizing: border-box; }
      body {
        margin:0; min-height:100vh; display:grid; place-items:center; background:var(--bg);
        color:var(--text); font-family:'Space Grotesk',ui-sans-serif,system-ui,sans-serif;
        padding:24px;
      }
      form { width:100%; max-width:320px; }
      h1 { font-size:40px; letter-spacing:-0.03em; line-height:1.06; margin:0 0 24px; }
      label { display:block; font-size:13px; color:var(--muted); margin-bottom:8px; }
      input {
        width:100%; padding:12px 14px; font:inherit; font-size:16px; color:var(--text);
        background:#fff; border:1px solid var(--card); border-radius:10px; outline:none;
      }
      input:focus { border-color:var(--accent); box-shadow:0 0 0 3px rgba(23,2,252,0.28); }
      button {
        width:100%; margin-top:12px; padding:12px 14px; font:inherit; font-size:15px; font-weight:500;
        color:#fcfcfc; background:var(--accent); border:0; border-radius:10px; cursor:pointer;
      }
      button:hover { background:#1200c9; }
      .error { margin:0 0 16px; padding:10px 12px; font-size:13px; color:var(--danger);
               background:rgba(217,43,43,0.08); border-radius:10px; }
    </style>
  </head>
  <body>
    <form method="post" action="/login">
      <h1>Cortexual</h1>
      ${error ? `<p class="error">${escapeHTML(error)}</p>` : ''}
      <label for="password">Password</label>
      <input id="password" name="password" type="password" autocomplete="current-password" autofocus required />
      <input type="hidden" name="next" value="${escapeHTML(next)}" />
      <button type="submit">Sign in</button>
    </form>
  </body>
</html>`
}
