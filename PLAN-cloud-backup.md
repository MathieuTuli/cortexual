# Cloud Backup via AWS S3

## Context

Cortexual is a local-first personal knowledge management app (React + Vite + Zustand). All data (~289 cards, 11 spaces, ~556 MB media) is stored on the filesystem via Vite dev server middleware — a dev-only solution with no production story. The goal is to add cloud backup so data is safe and accessible across devices.

**AWS S3** is the best fit — the user already hosts on EC2, and S3 costs ~$0.25/mo at 10 GB vs $25/mo for Supabase. No new services or accounts needed.

## Architecture

```
App (React + Zustand)
  → StorageAdapter interface
    → LocalAdapter (IndexedDB via Dexie)     ← primary, always used
    → S3Adapter (AWS SDK)                    ← cloud backup target
  → SyncEngine (manual push/pull, last-write-wins)
```

**S3 bucket structure:**
```
cortexual-backup/
  cards.json              ← all cards as JSON array
  spaces.json             ← all spaces as JSON array
  media/{cardId}/{file}   ← media blobs
  manifest.json           ← sync metadata (lastSyncedAt, file checksums)
```

The app stays local-first. S3 is an opt-in backup target — no auth UI needed since credentials come from env vars (personal tool).

---

## Phase 1: Switch to IndexedDB (local storage)

The current file-based Vite middleware is dev-only. Activate the existing Dexie setup as the real local persistence layer.

**Files to create:**
- `src/core/storage/types.ts` — `StorageAdapter` interface matching current `api` shape
- `src/core/storage/local-adapter.ts` — implements adapter using existing `src/core/db/index.ts`
- `src/core/storage/index.ts` — factory returning the local adapter
- `src/core/storage/migrate-from-files.ts` — one-time migration: fetch from file API → write to IndexedDB

**Files to modify:**
- `src/core/stores/cards-store.ts` — replace `import { api }` with storage adapter calls
- `src/core/stores/spaces-store.ts` — same
- `src/core/utils/import-export.ts` — same
- `src/App.tsx` — add migration check on first load

**Verify:** App works identically with IndexedDB. Cards, spaces, media all display correctly.

---

## Phase 2: S3 Cloud Adapter

**Install:** `@aws-sdk/client-s3`

**AWS setup (one-time):**
1. Create S3 bucket `cortexual-backup` (or similar) in your preferred region
2. Create IAM user `cortexual-app` with policy scoped to only this bucket:
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:GetObject", "s3:PutObject", "s3:ListBucket", "s3:DeleteObject"],
    "Resource": [
      "arn:aws:s3:::cortexual-backup",
      "arn:aws:s3:::cortexual-backup/*"
    ]
  }]
}
```
3. Enable CORS on the bucket for your app's origin
4. Store credentials in `.env`:
```
VITE_AWS_REGION=us-east-1
VITE_AWS_ACCESS_KEY_ID=...
VITE_AWS_SECRET_ACCESS_KEY=...
VITE_S3_BUCKET=cortexual-backup
```

**Files to create:**
- `src/core/s3/client.ts` — initialize S3 client from env vars, with graceful fallback if not configured
- `src/core/storage/s3-adapter.ts` — implements `StorageAdapter`:
  - `pushCards()` → `PutObject` cards.json
  - `pullCards()` → `GetObject` cards.json
  - `pushSpaces()` → `PutObject` spaces.json
  - `pullSpaces()` → `GetObject` spaces.json
  - `uploadMedia(cardId, blob)` → `PutObject` media/{cardId}/{filename}
  - `downloadMedia(cardId)` → `GetObject` media/{cardId}/*
  - `listMedia()` → `ListObjectsV2` to check what's already uploaded
- `.env.example` — document required env vars

**Verify:** Can upload/download JSON and media files to S3 bucket via browser console.

---

## Phase 3: Sync Engine

**Strategy:** Manual push/pull with last-write-wins on `updatedAt`. Simple and predictable for a single-user tool.

**Files to create:**
- `src/core/sync/sync-engine.ts`:
  - `backupToCloud()` — read all from IndexedDB, upload cards.json + spaces.json + media to S3
  - `restoreFromCloud()` — download from S3, write to IndexedDB
  - `incrementalSync()` — only upload/download items changed since `lastSyncedAt`
  - Track `lastSyncedAt` + media manifest in localStorage
- `src/core/sync/media-sync.ts` — upload/download media with progress tracking, skip files already in S3 (check via ListObjectsV2 or local manifest)
- `src/core/stores/sync-store.ts` — Zustand store (syncStatus, lastSyncedAt, progress, errors)

**Sync algorithm:**
```
Backup:
  1. Read all cards/spaces from IndexedDB
  2. Upload cards.json and spaces.json to S3 (full overwrite)
  3. For each media file: check manifest → skip if already uploaded → upload if new
  4. Update manifest.json in S3 + lastSyncedAt in localStorage

Restore:
  1. Download cards.json and spaces.json from S3
  2. Merge with local data (last-write-wins on updatedAt)
  3. Download media files that don't exist locally (lazy or eager based on user choice)
  4. Update lastSyncedAt
```

**Verify:** Push all local data to S3, clear IndexedDB, restore from S3 — all data intact.

---

## Phase 4: Sync UI

**Files to create:**
- `src/components/sync/SyncPanel.tsx` — "Backup to Cloud" / "Restore from Cloud" buttons with progress bar, last-synced timestamp, S3 connection status
- `src/components/sync/SyncStatusBadge.tsx` — small indicator in sidebar

**Files to modify:**
- `src/components/layout/Sidebar.tsx` — add SyncPanel (visible when S3 is configured)

**Verify:** Full end-to-end: backup → clear local → restore → all data intact including media.

---

## Phase 5: Cleanup

- Remove `fileStoragePlugin()` from `vite.config.ts` (270 lines of middleware)
- Remove `src/core/api.ts` (replaced by storage adapter)
- Add graceful fallback if S3 env vars are not set (local-only mode, sync UI hidden)

---

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Cloud backend | AWS S3 | ~$0.25/mo at 10 GB, user already on AWS |
| Auth | None (IAM credentials in env vars) | Personal tool, single user |
| Sync strategy | Manual push/pull | Predictable, no surprises |
| Conflict resolution | Last-write-wins | Single user, conflicts rare |
| Media sync | Skip already-uploaded files | Avoids re-uploading 556 MB |
| Local persistence | IndexedDB (Dexie) | Already configured, production-ready |
| S3 data format | JSON files + raw media blobs | Simple, human-readable, portable |

## Cost at Scale

| Data Size | Monthly Cost |
|-----------|-------------|
| 1 GB | ~$0.03 |
| 10 GB | ~$0.25 |
| 100 GB | ~$2.50 |
