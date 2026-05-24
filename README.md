# Call & Text Log

A local archive viewer for SMS Backup & Restore XML exports.

- **Rust CLI** (`parser/`) streams the giant XML, writes a SQLite database with
  FTS5 full-text search, and extracts MMS attachments to disk.
- **Next.js app** (`web/`) reads the SQLite file and lets you browse,
  filter, and search messages and call history with images inline.

Everything runs locally. No accounts, no cloud, no upload.

## Layout

```
call-and-text-log-app/
├── parser/                # Rust CLI
├── web/                   # Next.js App Router
├── data/                  # generated (gitignored)
│   ├── data.db
│   └── mms/<shard>/<sha256>.<ext>
├── calls-*.xml            # input (gitignored)
└── sms-*.xml              # input (gitignored)
```

## One-time setup

```bash
# 1. Build the parser
cd parser
cargo build --release

# 2. Parse the XML files into SQLite + image folder
./target/release/sms-parser \
  --calls ../calls-20251001192225.xml \
  --sms   ../sms-20251001192225.xml

# 3. Install web deps
cd ../web
pnpm install
pnpm approve-builds   # one-time: allow better-sqlite3 native build
```

The SMS parse can take a while on a 10 GB file (mostly base64 decode + image
write). Re-runs are idempotent — running the parser again with the same files
won't duplicate rows.

## Running

```bash
cd web
pnpm dev
```

Open http://localhost:3000.

## Schema

- `messages` — one row per SMS or MMS; `kind` distinguishes them.
  `conversation_key` is the sorted set of normalized numbers in the thread,
  so group MMS conversations stay grouped regardless of address ordering.
- `calls` — one row per call.
- `attachments` — image / video / audio parts of MMS, keyed by SHA-256 of the
  decoded bytes. Files live at `data/mms/<first-2-of-hash>/<hash>.<ext>`.
- `messages_fts` — FTS5 index over `body`, `contact_name`, `address`.

## Phone number normalization

Numbers are stored both raw (`address`) and digits-only with the leading US `1`
stripped (`address_normalized`). Search by partial number works against the
normalized form. Group MMS addresses are joined with `~` in the raw value and
ordered+joined with `|` in `conversation_key`.

## Re-importing a fresh export

Drop the new `calls-*.xml` / `sms-*.xml` next to the originals and re-run the
parser. UID hashes deduplicate, so only new messages get inserted. Existing
attachments aren't re-decoded if their hash already exists on disk.

## Caveats

- The web app opens the database read-only. To rebuild from scratch, delete
  `data/data.db` and re-run the parser.
- MMS attachment "filename" comes from the `cl` attribute in the XML, which is
  often missing or generic (`Screensho.jpg`). The on-disk filename is the
  content hash; the original name is preserved in the `filename` column for
  display only.
