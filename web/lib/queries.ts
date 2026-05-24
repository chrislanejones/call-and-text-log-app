import { getDb } from "./db";
import type {
  Attachment,
  Call,
  Conversation,
  Message,
  MessageFilters,
} from "./types";

// FTS5 query sanitization: escape double quotes, wrap each token in quotes.
// This avoids syntax errors from punctuation and gives a substring-friendly match.
function ftsQuery(input: string): string {
  const tokens = input
    .trim()
    .split(/\s+/)
    .map((t) => t.replace(/"/g, '""'))
    .filter(Boolean);
  if (tokens.length === 0) return "";
  return tokens.map((t) => `"${t}"*`).join(" ");
}

export function listConversations(opts: { limit?: number; q?: string } = {}): Conversation[] {
  const db = getDb();
  const limit = opts.limit ?? 200;

  if (opts.q) {
    const fts = ftsQuery(opts.q);
    const rows = db
      .prepare(
        `
        SELECT m.conversation_key,
               COALESCE(NULLIF(m.contact_name, '(Unknown)'), m.contact_name, m.address) AS display_name,
               MAX(m.date) AS last_date,
               SUBSTR((SELECT body FROM messages WHERE conversation_key = m.conversation_key
                       ORDER BY date DESC LIMIT 1), 1, 140) AS last_body,
               COUNT(*) AS message_count
        FROM messages m
        WHERE m.rowid IN (SELECT rowid FROM messages_fts WHERE messages_fts MATCH ?)
        GROUP BY m.conversation_key
        ORDER BY last_date DESC
        LIMIT ?
        `,
      )
      .all(fts, limit) as Conversation[];
    return rows;
  }

  return db
    .prepare(
      `
      SELECT conversation_key,
             COALESCE(NULLIF(contact_name, '(Unknown)'), contact_name, address) AS display_name,
             MAX(date) AS last_date,
             SUBSTR((SELECT body FROM messages WHERE conversation_key = m.conversation_key
                     ORDER BY date DESC LIMIT 1), 1, 140) AS last_body,
             COUNT(*) AS message_count
      FROM messages m
      GROUP BY conversation_key
      ORDER BY last_date DESC
      LIMIT ?
      `,
    )
    .all(limit) as Conversation[];
}

export function listMessages(filters: MessageFilters): Message[] {
  const db = getDb();
  const where: string[] = [];
  const params: unknown[] = [];

  if (filters.conversation) {
    where.push("m.conversation_key = ?");
    params.push(filters.conversation);
  }
  if (filters.contact) {
    where.push("m.contact_name LIKE ?");
    params.push(`%${filters.contact}%`);
  }
  if (filters.number) {
    where.push("m.address_normalized LIKE ?");
    params.push(`%${filters.number.replace(/\D/g, "")}%`);
  }
  if (filters.hasImages) where.push("m.has_images = 1");
  if (filters.type != null) {
    where.push("m.type = ?");
    params.push(filters.type);
  }
  if (filters.dateFrom != null) {
    where.push("m.date >= ?");
    params.push(filters.dateFrom);
  }
  if (filters.dateTo != null) {
    where.push("m.date <= ?");
    params.push(filters.dateTo);
  }

  let fromClause = "messages m";
  if (filters.q && filters.q.trim()) {
    fromClause = `messages m JOIN messages_fts ON messages_fts.rowid = m.rowid`;
    where.push("messages_fts MATCH ?");
    params.push(ftsQuery(filters.q));
  }

  const sql = `
    SELECT m.rowid, m.kind, m.address, m.address_normalized, m.conversation_key,
           m.contact_name, m.body, m.date, m.type, m.readable_date, m.has_images
    FROM ${fromClause}
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY m.date ASC
    LIMIT ? OFFSET ?
  `;
  params.push(filters.limit ?? 500, filters.offset ?? 0);

  const messages = db.prepare(sql).all(...params) as Message[];

  if (messages.length === 0) return messages;

  // Attach attachments for any MMS rows with images.
  const ids = messages.filter((m) => m.has_images).map((m) => m.rowid);
  if (ids.length > 0) {
    const placeholders = ids.map(() => "?").join(",");
    const atts = db
      .prepare(
        `SELECT message_rowid, hash, content_type, filename, size
         FROM attachments WHERE message_rowid IN (${placeholders})`,
      )
      .all(...ids) as (Attachment & { message_rowid: number })[];
    const byMsg = new Map<number, Attachment[]>();
    for (const a of atts) {
      const arr = byMsg.get(a.message_rowid) ?? [];
      arr.push({
        hash: a.hash,
        content_type: a.content_type,
        filename: a.filename,
        size: a.size,
      });
      byMsg.set(a.message_rowid, arr);
    }
    for (const m of messages) {
      if (m.has_images) m.attachments = byMsg.get(m.rowid) ?? [];
    }
  }

  return messages;
}

export function countMessages(filters: MessageFilters): number {
  const db = getDb();
  const where: string[] = [];
  const params: unknown[] = [];

  if (filters.conversation) {
    where.push("m.conversation_key = ?");
    params.push(filters.conversation);
  }
  if (filters.contact) {
    where.push("m.contact_name LIKE ?");
    params.push(`%${filters.contact}%`);
  }
  if (filters.number) {
    where.push("m.address_normalized LIKE ?");
    params.push(`%${filters.number.replace(/\D/g, "")}%`);
  }
  if (filters.hasImages) where.push("m.has_images = 1");
  if (filters.type != null) {
    where.push("m.type = ?");
    params.push(filters.type);
  }
  if (filters.dateFrom != null) {
    where.push("m.date >= ?");
    params.push(filters.dateFrom);
  }
  if (filters.dateTo != null) {
    where.push("m.date <= ?");
    params.push(filters.dateTo);
  }

  let fromClause = "messages m";
  if (filters.q && filters.q.trim()) {
    fromClause = `messages m JOIN messages_fts ON messages_fts.rowid = m.rowid`;
    where.push("messages_fts MATCH ?");
    params.push(ftsQuery(filters.q));
  }

  const sql = `SELECT COUNT(*) AS n FROM ${fromClause} ${
    where.length ? "WHERE " + where.join(" AND ") : ""
  }`;
  const row = db.prepare(sql).get(...params) as { n: number };
  return row.n;
}

export function listCalls(opts: {
  q?: string;
  type?: number;
  dateFrom?: number;
  dateTo?: number;
  limit?: number;
  offset?: number;
}): Call[] {
  const db = getDb();
  const where: string[] = [];
  const params: unknown[] = [];

  if (opts.q) {
    where.push("(contact_name LIKE ? OR number_normalized LIKE ?)");
    const like = `%${opts.q}%`;
    params.push(like, like.replace(/\D/g, ""));
  }
  if (opts.type != null) {
    where.push("type = ?");
    params.push(opts.type);
  }
  if (opts.dateFrom != null) {
    where.push("date >= ?");
    params.push(opts.dateFrom);
  }
  if (opts.dateTo != null) {
    where.push("date <= ?");
    params.push(opts.dateTo);
  }

  const sql = `
    SELECT rowid, number, number_normalized, contact_name, duration, date, type, readable_date
    FROM calls
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY date DESC
    LIMIT ? OFFSET ?
  `;
  params.push(opts.limit ?? 500, opts.offset ?? 0);
  return db.prepare(sql).all(...params) as Call[];
}

export function getStats() {
  const db = getDb();
  const messages = db.prepare("SELECT COUNT(*) AS n FROM messages").get() as { n: number };
  const calls = db.prepare("SELECT COUNT(*) AS n FROM calls").get() as { n: number };
  const attachments = db.prepare("SELECT COUNT(*) AS n FROM attachments").get() as { n: number };
  const conversations = db
    .prepare("SELECT COUNT(DISTINCT conversation_key) AS n FROM messages")
    .get() as { n: number };
  return {
    messages: messages.n,
    calls: calls.n,
    attachments: attachments.n,
    conversations: conversations.n,
  };
}
