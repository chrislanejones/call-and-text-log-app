# Call & Text Log

A fully local, fully offline archive viewer for SMS Backup &amp; Restore XML
exports. Browse, search, and re-experience years of text and call history
without sending a byte to anyone.

- **Rust CLI** streams the giant XML once, writes a SQLite database
  (with FTS5), and extracts MMS attachments to disk.
- **Next.js + React app** reads the database and serves a fast, virtualized
  UI with a date scrubber, photo gallery, dark mode, and full-text search.

No accounts, no cloud, no upload. Everything you see is rendered from a
`.db` file and an image folder on your machine.

---

## Why this exists

[SMS Backup & Restore](https://synctech.com.au/) is the standard Android
way to dump your message history, but the resulting XML is hostile to
read: gigabytes of base64-encoded MMS images interleaved with `<sms>` and
`<mms>` tags. The vendor's own web viewer requires uploading the file, and
its third-party viewers tend to choke past a few hundred MB.

This project turns that XML into a comfortable, queryable archive. Real
numbers from the test dataset (a personal 7-year backup):

| | |
|---|---|
| Input | **10.7 GB XML**, 145,785 messages + 1,031 calls |
| Parse time | **~28 s** (release Rust on a modern laptop) |
| Output DB | 108 MB (with FTS5 index) |
| Output images | 7.1 GB, sharded by SHA-256 (~13k unique files) |
| UI cold load of largest conversation (36k msgs) | **~500 ms** |

---

## Layout

```
call-and-text-log-app/
├── parser/                # Rust CLI (quick-xml + rusqlite + sha2)
│   └── src/main.rs
├── web/                   # Next.js 15 App Router + React 19 + Tailwind
│   ├── app/
│   │   ├── _components/   # AppShell, MessagesView, CallsView, ThemeToggle
│   │   ├── api/           # /conversations, /messages, /calls, /stats, /image/[hash]
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── lib/
│   │   ├── db.ts          # better-sqlite3 singleton
│   │   ├── queries.ts     # all SQL lives here
│   │   └── types.ts
│   └── pnpm-workspace.yaml
├── data/                  # generated — gitignored
│   ├── data.db
│   └── mms/<aa>/<sha256>.<ext>
├── calls-*.xml            # input — gitignored
└── sms-*.xml              # input — gitignored
```

---

## One-time setup

Requires Rust (stable), Node 22+, and [pnpm](https://pnpm.io/) (or use
corepack: `corepack enable`).

```bash
# 1. Build the Rust parser
cd parser
cargo build --release

# 2. Parse the XML into SQLite + image folder (from repo root)
cd ..
./parser/target/release/sms-parser \
  --calls calls-20251001192225.xml \
  --sms   sms-20251001192225.xml

# 3. Install web deps and approve the native better-sqlite3 build
cd web
pnpm install
pnpm approve-builds   # one-time; allows better-sqlite3 + sharp to compile
```

Parser re-runs are idempotent — running it again with the same XML doesn't
duplicate rows, and existing images aren't re-decoded if their content hash
already exists on disk.

## Running

```bash
cd web
pnpm dev
```

Open **http://localhost:3000**.

---

## Features

### Messages tab

- **Conversation sidebar** with live search across contact names and the
  last message body
- **Virtualized timeline** (`react-virtuoso`) — handles a 36k-message
  conversation without breaking a sweat; only the visible window is in
  the DOM
- **Full-text search** (SQLite FTS5, porter stemmer, prefix-match per
  token) across message bodies, contact names, and addresses
- **Date scrubber** on the right side, à la Google Photos: years stacked
  newest→oldest with per-year counts; click a year to expand months;
  click any month to jump the timeline to it; the active month tracks
  the viewport as you scroll
- **Gallery view** — toggle the "Gallery" button in the filter bar to
  swap the timeline for a ChatGPT-style square thumbnail grid of every
  image in the current filter, newest first, date under each tile.
  Click a thumbnail for full size in a new tab.
- **Filters**: date range, gallery toggle, free-text search, conversation
  selector — all compose
- **MMS rendering**: images, video, audio all play inline; unknown types
  show as download links

### Calls tab

- Filter by name, number, type (incoming/outgoing/missed/voicemail/
  rejected/blocked), and date range
- Color-coded type column, duration formatted as `Nm Ss`

### Both

- **Dark mode** toggle in the header; choice is saved to `localStorage`
  and applied before the first paint to avoid a flash
- Defaults to your system preference until you click the toggle

---

## How it works

### Parser (`parser/src/main.rs`)

- Streams the XML with [`quick-xml`](https://crates.io/crates/quick-xml) —
  never holds more than one element in memory, so RAM stays flat regardless
  of file size
- For each `<sms>` and `<mms>`, emits a row keyed by a UID hash so re-runs
  are idempotent (`INSERT OR IGNORE`)
- Inside each `<mms>`, the inner `<parts>` are parsed:
  - `text/*` parts are concatenated into the message `body`
  - `image/*`, `video/*`, `audio/*` parts have their base64 `data` decoded,
    SHA-256'd, written to `data/mms/<first-2-of-hash>/<hash>.<ext>`,
    and recorded in the `attachments` table
- Identical attachments across different messages are deduplicated by hash
- A progress bar tracks bytes-read so you know the ETA on huge files

### Database schema

- **`messages`** — one row per SMS or MMS; `kind` distinguishes them.
  `conversation_key` is the sorted set of normalized phone numbers in the
  thread, joined with `|`, so group MMS threads stay grouped regardless
  of which numbers come first.
- **`calls`** — one row per call.
- **`attachments`** — image/video/audio parts of MMS, FK to messages,
  keyed by SHA-256.
- **`messages_fts`** — FTS5 virtual table over `body`, `contact_name`,
  `address`, kept in sync via triggers.

### Phone number normalization

Stored both raw (`address`) and digits-only with the US `+1` country code
stripped (`address_normalized`). Search by partial number works against
the normalized form. Group MMS addresses look like
`+1234~+5678~+9012` in the raw value and get sorted+joined as
`1234|5678|9012` in `conversation_key`.

### Web app

- **`better-sqlite3`** opens the database read-only in a Node singleton —
  one connection per dev process
- All SQL is hand-written in `lib/queries.ts`; no ORM
- API routes are tiny `GET` handlers that translate query params to
  `queries.ts` calls and return JSON
- The image route streams files straight from disk with `cache-control:
  immutable` (safe since the path is content-addressed)
- Client uses plain `useEffect` + `fetch` with a 200 ms debounce on
  filter changes — no SWR, no react-query

---

## Re-importing a fresh export

Drop the new `calls-*.xml` / `sms-*.xml` next to the originals and re-run
the parser. UID hashes deduplicate at the row level; image hashes
deduplicate on disk. Only the genuinely new content gets written.

## Caveats

- The web app opens the database read-only. To rebuild from scratch,
  delete `data/data.db*` and `data/mms/` then re-run the parser.
- MMS attachment "filename" comes from the `cl` attribute in the XML,
  which is often missing or generic (`Screensho.jpg`). The on-disk
  filename is always the content hash; the original name is preserved
  in the `attachments.filename` column for display only.
- After a Node major-version upgrade, the native `better-sqlite3` binary
  needs a rebuild: `pnpm rebuild better-sqlite3`, or if pnpm reports
  "ignored builds", `pnpm approve-builds better-sqlite3`.

## License

Personal use. Bring your own data.
