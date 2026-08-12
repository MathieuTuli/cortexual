# Cortexual extension

Unpacked-only. There is no Web Store listing and no build step — the files here
are what Chrome loads.

## Install

1. Start the library: `npm run dev` (or `npm run serve` for the built app).
2. Open `chrome://extensions`, turn on **Developer mode**.
3. **Load unpacked** → pick this `extension/` folder.

## What it does

| Action | How |
|---|---|
| Save the page | Toolbar icon → **Save page**, or ⌘⇧S |
| Save a link | Right-click a link → **Save page to Cortexual** |
| Save a highlight | Select text → **❝ Save**, or right-click → **Save highlight** |
| Save an image | Right-click an image → **Save image to Cortexual** |

Highlights capture the page title, canonical URL, `og:site_name`, and the author
from `meta[name=author]` or JSON-LD. Images are downloaded and stored locally, so
a card survives the page taking the image down.

After saving from the popup you get related cards from your own library.

## Notes

- It talks to `http://127.0.0.1:3001` and nothing else. No accounts, no auth —
  the daemon is loopback-only.
- If the daemon isn't running the popup says so rather than failing silently.
- Content scripts can't reach the daemon directly (a page's CSP blocks it), so
  saves are proxied through the service worker.
