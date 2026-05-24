"use client";

import { useEffect, useMemo, useState } from "react";
import type { Conversation, Message } from "@/lib/types";

function fmtDate(ms: number) {
  if (!ms) return "";
  return new Date(ms).toLocaleString();
}

function dateInputToMs(v: string): number | undefined {
  if (!v) return undefined;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : undefined;
}

export default function MessagesView() {
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [convQ, setConvQ] = useState("");
  const [selectedConv, setSelectedConv] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // search/filter
  const [q, setQ] = useState("");
  const [hasImages, setHasImages] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // load conversation list (debounced search)
  useEffect(() => {
    const t = setTimeout(() => {
      const url = new URL("/api/conversations", window.location.origin);
      if (convQ) url.searchParams.set("q", convQ);
      url.searchParams.set("limit", "300");
      fetch(url)
        .then((r) => r.json())
        .then((d) => setConvs(d.conversations));
    }, 200);
    return () => clearTimeout(t);
  }, [convQ]);

  // load messages for current selection / filter
  useEffect(() => {
    const t = setTimeout(() => {
      const url = new URL("/api/messages", window.location.origin);
      if (selectedConv) url.searchParams.set("conversation", selectedConv);
      if (q) url.searchParams.set("q", q);
      if (hasImages) url.searchParams.set("hasImages", "1");
      const f = dateInputToMs(dateFrom);
      const tEnd = dateInputToMs(dateTo);
      if (f) url.searchParams.set("dateFrom", String(f));
      if (tEnd) url.searchParams.set("dateTo", String(tEnd + 24 * 3600 * 1000 - 1));
      url.searchParams.set("limit", "1000");
      setLoading(true);
      fetch(url)
        .then((r) => r.json())
        .then((d) => {
          setMessages(d.messages);
          setTotal(d.total);
        })
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(t);
  }, [selectedConv, q, hasImages, dateFrom, dateTo]);

  return (
    <div className="h-full grid grid-cols-[300px_1fr] min-h-0">
      {/* Conversation sidebar */}
      <aside className="border-r bg-white flex flex-col min-h-0">
        <div className="p-2 border-b">
          <input
            type="search"
            placeholder="Filter conversations..."
            value={convQ}
            onChange={(e) => setConvQ(e.target.value)}
            className="w-full px-2 py-1.5 text-sm border rounded"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {convs.map((c) => (
            <button
              key={c.conversation_key}
              onClick={() => {
                setSelectedConv(c.conversation_key);
                setSelectedName(c.display_name);
              }}
              className={`w-full text-left px-3 py-2 border-b text-sm ${
                selectedConv === c.conversation_key
                  ? "bg-blue-50"
                  : "hover:bg-neutral-50"
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium truncate">{c.display_name || "(no name)"}</span>
                <span className="text-xs text-neutral-500 shrink-0">
                  {c.message_count.toLocaleString()}
                </span>
              </div>
              <div className="text-xs text-neutral-500 truncate">{c.last_body}</div>
              <div className="text-[10px] text-neutral-400">{fmtDate(c.last_date)}</div>
            </button>
          ))}
          {convs.length === 0 && (
            <div className="p-4 text-sm text-neutral-500">No conversations.</div>
          )}
        </div>
      </aside>

      {/* Messages pane */}
      <section className="flex flex-col min-h-0">
        <div className="border-b bg-white p-2 flex flex-wrap gap-2 items-center">
          <input
            type="search"
            placeholder="Search messages (FTS)..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="flex-1 min-w-[200px] px-3 py-1.5 text-sm border rounded"
          />
          <label className="text-xs flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={hasImages}
              onChange={(e) => setHasImages(e.target.checked)}
            />
            has images
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-2 py-1.5 text-sm border rounded"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-2 py-1.5 text-sm border rounded"
          />
          {selectedConv && (
            <button
              onClick={() => {
                setSelectedConv(null);
                setSelectedName("");
              }}
              className="text-xs px-2 py-1 rounded border hover:bg-neutral-100"
            >
              Clear conversation
            </button>
          )}
          <div className="text-xs text-neutral-500 ml-auto">
            {loading ? "Loading..." : `${total.toLocaleString()} matches`}
          </div>
        </div>

        {selectedName && (
          <div className="px-4 py-2 border-b bg-neutral-50 text-sm font-medium">
            {selectedName}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
          {messages.map((m) => (
            <MessageRow key={m.rowid} m={m} />
          ))}
          {!loading && messages.length === 0 && (
            <div className="text-sm text-neutral-500">No messages.</div>
          )}
        </div>
      </section>
    </div>
  );
}

function MessageRow({ m }: { m: Message }) {
  const isOut = m.type === 2;
  const bubble = isOut
    ? "bg-blue-500 text-white ml-auto"
    : "bg-neutral-200 text-neutral-900 mr-auto";
  return (
    <div className={`max-w-[70%] rounded-2xl px-3 py-2 text-sm ${bubble}`}>
      {!isOut && (
        <div className={`text-[10px] mb-0.5 ${isOut ? "text-blue-100" : "text-neutral-500"}`}>
          {m.contact_name || m.address}
        </div>
      )}
      {m.body && <div className="whitespace-pre-wrap break-words">{m.body}</div>}
      {m.attachments && m.attachments.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {m.attachments.map((a) =>
            a.content_type.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <a key={a.hash} href={`/api/image/${a.hash}`} target="_blank" rel="noreferrer">
                <img
                  src={`/api/image/${a.hash}`}
                  alt={a.filename ?? "attachment"}
                  className="max-h-64 max-w-xs rounded"
                  loading="lazy"
                />
              </a>
            ) : a.content_type.startsWith("video/") ? (
              <video
                key={a.hash}
                src={`/api/image/${a.hash}`}
                controls
                className="max-h-64 max-w-xs rounded"
              />
            ) : a.content_type.startsWith("audio/") ? (
              <audio key={a.hash} src={`/api/image/${a.hash}`} controls />
            ) : (
              <a
                key={a.hash}
                href={`/api/image/${a.hash}`}
                className={`text-xs underline ${isOut ? "text-blue-100" : "text-blue-700"}`}
              >
                {a.filename ?? a.content_type}
              </a>
            ),
          )}
        </div>
      )}
      <div className={`text-[10px] mt-1 ${isOut ? "text-blue-100" : "text-neutral-500"}`}>
        {new Date(m.date).toLocaleString()}
      </div>
    </div>
  );
}
