# Plan: Feature-match Sublime (desktop web + extension)

**Goal**: Cortexual, at your desk, with Sublime's capabilities minus the network:
canvas, semantic search, related cards, many-to-many collections, a capture extension,
and importers.

**Out of scope, permanently**: phones, tablets, responsive layout, PWA, hosting,
accounts, cross-user serendipity.

**Architecture**: The API moves out of the Vite dev-server plugin into a small
localhost-bound Node daemon so it's up whether or not a bundler is running. No auth —
it never leaves the machine. Storage stays files-on-disk. Frontend stays React 18 +
Vite + Tailwind + Zustand, desktop-only.

**Tech Stack**: TypeScript, React 18, Vite 6, Tailwind 3, Zustand, Hono,
transformers.js (ONNX), Vitest, CRXJS.

---

## What dropping the phone changed

The previous plan had a 16-day gate — server, database, auth, deploy — before anything
got better. **That gate existed entirely to serve the phone.** Remove it and:

- **N6 (auth) and N7 (deploy) are deleted.** Localhost-bound means nothing to secure and
  nothing to host.
- **Phase 3 (responsive, touch, PWA, Share Target) is deleted.** 7 days.
- **N4 (SQLite) demotes from gate to optional.** Whole-file JSON rewrite is fine for one
  person at 326 cards; do it when it hurts.
- **N3 (standalone server) demotes from gate to "only the extension needs it."**

Net: **~55 days → ~40 days**, and more importantly, time-to-first-improvement goes from
16 days to about one. Almost nothing is gated on anything else now. The plan is a menu,
not a critical path.

It also resolves three of the seven uncertainties outright: which phone, client-vs-server
embeddings (the server *is* local now), and hosting choice.

---

## Current state at `7b33bec`

| Fact | Consequence |
|---|---|
| API is `configureServer` only (`vite.config.ts:155-479`) | `npm run build` output 404s on `/api/cards`; app only runs under `npm run dev` |
| Whole-file rewrite per mutation (`vite.config.ts:186-188`) | 1.2 MB rewritten per card edit — tolerable solo, not free |
| `src/core/db/index.ts` (Dexie) unreferenced | verified dead code, delete it |
| No range requests on media | video scrubbing is broken *locally too* |
| `SelectionBox` mouse-only (`SelectionBox.tsx:125-127`) | fine forever now — desktop only |
| Zero tests, 5,497 LOC | no safety net |
| `npm run lint` broken; `ImportExport` unmounted | two small regressions |
| 326 cards, 627 MB media, `data/` gitignored | **only copy of your library, no history** |

---

## The graph

```
GROUP 0 — safety net (no deps)
  N0 eslint flat config
  N1 Vitest harness
  N2 re-mount ImportExport
  N3 delete dead Dexie layer

GROUP A — schema (no deps)                  GROUP B — canvas (needs A1)
  A1 many-to-many cards↔collections           B1 position schema
  A2 provenance fields                        B2 canvas surface
       └─> A3 highlight card type ──┐
                                    │
GROUP C — intelligence (no deps)    │       GROUP D — local daemon (no deps)
  C1 embedding pipeline             │         D1 extract API → Hono daemon
       ├─> C2 semantic search       │         D2 media range requests
       └─> C3 related cards ──┐     │              │
                              │     │              │
GROUP E — extension (needs D1) ◄────┴─────────────┘
  E1 MV3 scaffold
       ├─> E2 save page/link
       ├─> E3 highlight → card        (needs A2, A3)
       ├─> E4 right-click image save
       └─> E5 related-on-save         (needs C3)

GROUP F — importers (needs A2)
  F1 Kindle · F2 X bookmarks · F3 Instagram · F4 Readwise

OPTIONAL — SQLite (do when JSON hurts)
  X1 migrate cards.json/spaces.json → SQLite
```

Groups 0, A, C, D are all independent — start any of them today.

---

## Node specs

### Group 0 — safety net · 2 days

**N0. ESLint flat config** — 30 min
Create `eslint.config.js` (ESLint 9 flat format) wiring `typescript-eslint`,
`eslint-plugin-react-hooks`, `eslint-plugin-react-refresh` — all already in
`devDependencies`. Verify: `npm run lint` exits 0.

**N1. Vitest harness** — 1 day
Add `vitest`, `@testing-library/react`, `jsdom`. `"test": "vitest run"`.
Seed against pure logic that's easy to get wrong and already exists:
`src/core/utils/csv.ts` (`parseCsvRows` — quoted fields, embedded newlines, CRLF),
`url-parser.ts`, `time-ago.ts`. Verify: `npm test` green, ≥3 files covered.

**N2. Re-mount ImportExport** — 30 min
Orphaned since `7b33bec`. Mount in `Sidebar.tsx` (the old one had it at line 38) or
behind a settings affordance in `TopBar.tsx`, restyled for the glass UI.
Verify: import and export both reachable.

**N3. Delete Dexie layer** — 15 min
`src/core/db/index.ts` is unreferenced (verified). Remove it and the `dexie` /
`dexie-react-hooks` dependencies. Two storage stories in one tree is a trap.

### Group A — schema · 4 days

**A1. Many-to-many cards↔collections** — 2 days
The single biggest structural gap vs Sublime. Join table (or `spaceIds: string[]` if
staying on JSON). Drop `Card.spaceId` (`src/core/types/card.ts:20`). Touches
`cards-store.ts` (`getCardsBySpace`, `moveCardsToSpace` → `addToSpace`/`removeFromSpace`),
`SelectionActionBar`, `RightRail` scoping, and the CSV importer's space resolution.
**Destructive** — see Risks. Verify: a card in two spaces; removing from one leaves the other.

**A2. Provenance fields** — 1 day
`author`, `sourceUrl`, `siteName`, `excerpt` on the card base. Prerequisite for
highlights meaning anything and for every importer.

**A3. Highlight card type** — 1 day
New variant in the `CardSchema` discriminated union + `CardHighlight` renderer
(quote styling, attribution line).

### Group B — canvas · 5.5 days · needs A1

Promoted. With the phone gone this is the highest-value thing on the list — it's
Sublime's differentiator that *doesn't* need a network, and it's pure frontend.

**B1. Position schema** — 0.5 day
`x`, `y`, `z`, `w`, `h` in a per-space layout map, **not** on the card — a card in N
spaces needs N positions, which is exactly why this follows A1.

**B2. Canvas surface** — 5 days
Pan/zoom viewport, drag-to-move, marquee reuse from `SelectionBox`. Note the existing
`zoomLevel` in `app-store.ts` is discrete grid density, not a continuous transform —
this is new machinery, not a reuse. Canvas becomes a third mode alongside grid/list in
`use-view-mode.ts`.

### Group C — intelligence · 6 days

**C1. Embedding pipeline** — 3 days
`@xenova/transformers` running `all-MiniLM-L6-v2`. Embed on create/update, backfill the
326 existing. Store in a dedicated sidecar (`data/embeddings.bin` + index, or SQLite if
X1 has landed) — **not** in `cards.json`, which is already 1.2 MB.
326 × 384-dim float32 ≈ 500 KB; brute-force cosine is fine well past 50k cards.
Runs in the daemon if D1 has landed, else in a web worker. Verify: nearest-neighbour of
a known card returns sane results.

**C2. Semantic search** — 2 days
Embed the query, rank by cosine, merge with the existing substring match in
`cards-store.ts:181-189` so exact-token matches still win. Debounced in `TopBar`.

**C3. Related cards** — 1 day
Top-k excluding self, rendered in `CardViewModal`.

### Group D — local daemon · 3.5 days

Only worth doing if you want the extension, or you're tired of `npm run dev` being your
database. Otherwise skippable.

**D1. Extract API → Hono daemon** — 3 days
`server/` at repo root. Port the 12 routes from `vite.config.ts:155-479` to Hono
(`@hono/node-server`), bound to `127.0.0.1`. Vite dev proxies `/api` → `localhost:3001`
so dev and built app hit identical code. Delete `fileStoragePlugin`. Run under launchd
so it survives reboots. **No auth** — localhost-bound, single user.
Verify: `npm run build && node server/` serves a working app; extension can reach it
with the bundler off.

**D2. Media range requests** — 0.5 day
Add `Content-Type`, `ETag`, `Cache-Control: immutable`, and `Range` support. Video
scrubbing is currently broken and this is why.

### Group E — extension · 11 days · needs D1

**E1. MV3 scaffold** — 2 days
`extension/` in-repo, CRXJS + Vite, sharing types with `src/core/types`. Service worker,
popup. No pairing flow needed — it talks to `127.0.0.1:3001` directly. Load unpacked;
no Web Store, no review, no listing.

**E2. Save page/link** — 2 days
Toolbar click → link card from the active tab (URL, title, OG image via the existing
`/api/link-preview`). Space picker + tag input in the popup.

**E3. Highlight → card** — 4 days · needs A2, A3
Content script: floating save affordance on text selection; capture selection text, page
title, author (`meta[name=author]`, JSON-LD), canonical URL. Plain HTML is v1. PDFs and
Google Docs are a separate extraction problem — treat as stretch, not scope.

**E4. Right-click image save** — 1 day
`contextMenus` on `image`; fetch in the worker, POST to `/api/media`.

**E5. Related-on-save** — 2 days · needs C3
After a save, popup shows related cards from your library. Same-library only.

### Group F — importers · 7 days · needs A2

All parse into the existing bulk path (`api.createCardsBulk`).

**F1. Kindle** — 1 day. Drop `My Clippings.txt`, parse delimiter-separated blocks →
highlight cards. No auth, no API, plain file.
**F2. X bookmarks** — 2 days. X data-export ZIP → link cards (`embedType: 'twitter'`
already handled by `url-parser.ts`).
**F3. Instagram saves** — 2 days. Instagram export ZIP → link or image cards.
**F4. Readwise** — 2 days. `GET /api/v2/export/` with a user token, paged by
`updatedAfter`. Requires a Readwise subscription — skip unless you already have one.

### Optional — X1. SQLite · 3 days

Do this when whole-file JSON actually hurts: noticeable save latency, a corrupted
`cards.json`, or C1 wanting a real vector store. Not before. `better-sqlite3`, schema in
`server/schema.sql`, one-shot migration from `data/*.json`. **Back up `data/` first.**

---

## Suggested order

| # | Group | Effort | Why here |
|---|---|---|---|
| 1 | 0 — safety net | 2d | Everything after is safer; two live regressions fixed |
| 2 | A — schema | 4d | Blocks canvas + importers; cheapest structural win |
| 3 | C — intelligence | 6d | Highest daily-use payoff, zero infrastructure |
| 4 | B — canvas | 5.5d | The marquee feature, now unblocked by A1 |
| 5 | D — daemon | 3.5d | Only if you want the extension |
| 6 | E — extension | 11d | Capture friction is what kills tools like this |
| 7 | F — importers | 7d | Do when you actually have a corpus to pull in |
| — | X1 — SQLite | 3d | When JSON hurts |

**~39 days**, versus 55 with the phone. Groups 0, A, C, D can each start immediately;
only B, E, and F have real predecessors.

If you want the shortest path to *feeling* different: **0 → C** is 8 days and gives you
natural-language search and related-cards across your whole library.

---

## Risks

- **A1 and X1 are the destructive steps**, and `data/` is gitignored — 326 cards and
  627 MB with no version history and one copy. Get a backup off the machine before
  either. This is the only genuinely irreversible thing in the plan.
- **E3 is the highest-variance node.** Selection capture across arbitrary sites is
  unbounded edge cases. Timebox it; accept partial site coverage.
- **B2 is new machinery, not a reuse.** The existing zoom is grid density, not a
  viewport transform. If you want edges/connections/mind-mapping rather than just
  spatial arrangement, multiply the estimate.
- **C3/E5 will underdeliver against Sublime by construction.** Same-library related
  cards on 326 items is much thinner than a cross-user corpus. Expect it to earn its
  keep only past a few thousand cards.
- **Estimates have no empirical basis** — zero tests means no observed velocity. ±50%,
  worse on E3 and B2.
- **The target is unobserved.** Nobody in this plan has actually used Sublime;
  `sublime.app` is behind a bot checkpoint. See Open decisions.

---

## Open decisions

1. **Buy a month of Sublime before building.** $50–200/yr against ~39 days of evenings
   to clone a product neither of us can inspect. Strongest recommendation in this file.
2. **Do you want the extension?** It's 14.5 days with its daemon prerequisite — over a
   third of the plan. If capture-at-desk via the existing Capture button is fine, cut
   Groups D and E and the plan is ~24 days.
3. **Backup strategy for `data/`** before anything in Group A runs.
