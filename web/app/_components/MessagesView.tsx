"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
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

type MonthBucket = { ym: string; year: number; month: number; firstIndex: number; count: number };
type YearBucket = { year: number; firstIndex: number; count: number; months: MonthBucket[] };

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function buildBuckets(messages: Message[]): YearBucket[] {
  if (messages.length === 0) return [];
  const yearMap = new Map<number, YearBucket>();
  for (let i = 0; i < messages.length; i++) {
    const d = new Date(messages[i].date);
    const year = d.getFullYear();
    const month = d.getMonth();
    let yb = yearMap.get(year);
    if (!yb) {
      yb = { year, firstIndex: i, count: 0, months: [] };
      yearMap.set(year, yb);
    }
    yb.count++;
    const lastMonth = yb.months[yb.months.length - 1];
    if (!lastMonth || lastMonth.month !== month) {
      yb.months.push({
        ym: `${year}-${String(month + 1).padStart(2, "0")}`,
        year,
        month,
        firstIndex: i,
        count: 1,
      });
    } else {
      lastMonth.count++;
    }
  }
  return Array.from(yearMap.values()).sort((a, b) => b.year - a.year);
}

const PANEL = "bg-white dark:bg-neutral-900";
const BORDER = "border-neutral-200 dark:border-neutral-800";
const SUBTLE = "bg-neutral-50 dark:bg-neutral-800";
const MUTED = "text-neutral-500 dark:text-neutral-400";
const MUTED_SOFT = "text-neutral-400 dark:text-neutral-500";
const INPUT =
  "px-2 py-1.5 text-sm border rounded bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100";
const HOVER = "hover:bg-neutral-50 dark:hover:bg-neutral-800";

export default function MessagesView() {
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [convQ, setConvQ] = useState("");
  const [selectedConv, setSelectedConv] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const [q, setQ] = useState("");
  const [gallery, setGallery] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const [activeYM, setActiveYM] = useState<string>("");
  const [expandedYear, setExpandedYear] = useState<number | null>(null);

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

  useEffect(() => {
    const t = setTimeout(() => {
      const url = new URL("/api/messages", window.location.origin);
      if (selectedConv) url.searchParams.set("conversation", selectedConv);
      if (q) url.searchParams.set("q", q);
      if (gallery) url.searchParams.set("hasImages", "1");
      const f = dateInputToMs(dateFrom);
      const tEnd = dateInputToMs(dateTo);
      if (f) url.searchParams.set("dateFrom", String(f));
      if (tEnd) url.searchParams.set("dateTo", String(tEnd + 24 * 3600 * 1000 - 1));
      url.searchParams.set("limit", "50000");
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
  }, [selectedConv, q, gallery, dateFrom, dateTo]);

  const buckets = useMemo(() => buildBuckets(messages), [messages]);
  const initialTop = messages.length > 0 ? messages.length - 1 : 0;

  function jumpTo(index: number) {
    virtuosoRef.current?.scrollToIndex({ index, align: "start", behavior: "auto" });
  }

  return (
    <div className="h-full grid grid-cols-[280px_1fr_88px] min-h-0">
      {/* Conversation sidebar */}
      <aside className={`border-r ${BORDER} ${PANEL} flex flex-col min-h-0`}>
        <div className={`p-2 border-b ${BORDER}`}>
          <input
            type="search"
            placeholder="Filter conversations..."
            value={convQ}
            onChange={(e) => setConvQ(e.target.value)}
            className={`w-full ${INPUT}`}
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
              className={`w-full text-left px-3 py-2 border-b text-sm ${BORDER} ${
                selectedConv === c.conversation_key
                  ? "bg-blue-50 dark:bg-blue-950/40"
                  : HOVER
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium truncate">{c.display_name || "(no name)"}</span>
                <span className={`text-xs ${MUTED} shrink-0`}>
                  {c.message_count.toLocaleString()}
                </span>
              </div>
              <div className={`text-xs ${MUTED} truncate`}>{c.last_body}</div>
              <div className={`text-[10px] ${MUTED_SOFT}`}>{fmtDate(c.last_date)}</div>
            </button>
          ))}
          {convs.length === 0 && (
            <div className={`p-4 text-sm ${MUTED}`}>No conversations.</div>
          )}
        </div>
      </aside>

      {/* Messages pane */}
      <section className="flex flex-col min-h-0">
        <div className={`border-b ${BORDER} ${PANEL} p-2 flex flex-wrap gap-2 items-center`}>
          <input
            type="search"
            placeholder="Search messages (full-text)..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className={`flex-1 min-w-[200px] px-3 py-1.5 text-sm border rounded ${INPUT}`}
          />
          <button
            onClick={() => setGallery((v) => !v)}
            title={gallery ? "Back to message list" : "Show image gallery"}
            className={`text-xs px-2.5 py-1.5 rounded border flex items-center gap-1.5 transition-colors ${
              gallery
                ? "bg-blue-500 text-white border-blue-500 hover:bg-blue-600"
                : `border-neutral-300 dark:border-neutral-700 ${HOVER}`
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="m21 15-5-5L5 21" />
            </svg>
            Gallery
          </button>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className={INPUT}
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className={INPUT}
          />
          {selectedConv && (
            <button
              onClick={() => {
                setSelectedConv(null);
                setSelectedName("");
              }}
              className={`text-xs px-2 py-1 rounded border ${BORDER} ${HOVER}`}
            >
              Clear conversation
            </button>
          )}
          <div className={`text-xs ml-auto ${MUTED}`}>
            {loading
              ? "Loading..."
              : `${messages.length.toLocaleString()} of ${total.toLocaleString()}`}
          </div>
        </div>

        {selectedName && (
          <div className={`px-4 py-2 border-b ${BORDER} ${SUBTLE} text-sm font-medium flex items-center justify-between`}>
            <span>{selectedName}</span>
            {activeYM && (
              <span className={`text-xs tabular-nums ${MUTED}`}>{activeYM}</span>
            )}
          </div>
        )}

        <div className="flex-1 min-h-0">
          {messages.length > 0 ? (
            gallery ? (
              <Gallery messages={messages} />
            ) : (
              <Virtuoso
                ref={virtuosoRef}
                data={messages}
                initialTopMostItemIndex={initialTop}
                rangeChanged={({ startIndex }) => {
                  const m = messages[startIndex];
                  if (!m) return;
                  const d = new Date(m.date);
                  setActiveYM(`${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`);
                }}
                itemContent={(_i, m) => <MessageRow m={m} />}
                className="px-4"
              />
            )
          ) : (
            <div className={`p-4 text-sm ${MUTED}`}>
              {loading ? "Loading..." : gallery ? "No images." : "No messages."}
            </div>
          )}
        </div>
      </section>

      {/* Date scrubber */}
      <aside className={`border-l ${BORDER} ${PANEL} overflow-y-auto select-none`}>
        <div className={`sticky top-0 ${PANEL} border-b ${BORDER} px-2 py-1.5 text-[10px] uppercase tracking-wider ${MUTED}`}>
          Dates
        </div>
        {buckets.map((yb) => {
          const expanded = expandedYear === yb.year;
          const yearActive = activeYM.endsWith(String(yb.year));
          return (
            <div key={yb.year} className={`border-b ${BORDER}`}>
              <button
                onClick={() => {
                  setExpandedYear(expanded ? null : yb.year);
                  jumpTo(yb.firstIndex);
                }}
                className={`w-full text-left px-2 py-1.5 text-sm flex items-baseline justify-between gap-1 ${
                  yearActive
                    ? "bg-blue-100 dark:bg-blue-900/40 font-semibold"
                    : HOVER
                }`}
              >
                <span>{yb.year}</span>
                <span className={`text-[10px] tabular-nums ${MUTED}`}>
                  {yb.count.toLocaleString()}
                </span>
              </button>
              {expanded && (
                <div className={SUBTLE}>
                  {yb.months.map((mb) => {
                    const monthActive =
                      activeYM === `${MONTH_NAMES[mb.month]} ${mb.year}`;
                    return (
                      <button
                        key={mb.ym}
                        onClick={() => jumpTo(mb.firstIndex)}
                        className={`w-full text-left pl-4 pr-2 py-1 text-xs flex items-baseline justify-between gap-1 ${
                          monthActive
                            ? "bg-blue-200 dark:bg-blue-800/50 font-medium"
                            : "hover:bg-neutral-100 dark:hover:bg-neutral-700"
                        }`}
                      >
                        <span>{MONTH_NAMES[mb.month]}</span>
                        <span className={`text-[10px] tabular-nums ${MUTED}`}>
                          {mb.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        {buckets.length === 0 && (
          <div className={`p-2 text-xs ${MUTED_SOFT}`}>—</div>
        )}
      </aside>
    </div>
  );
}

type GalleryItem = {
  hash: string;
  content_type: string;
  filename: string | null;
  date: number;
  contact_name: string;
};

function flattenImages(messages: Message[]): GalleryItem[] {
  const out: GalleryItem[] = [];
  for (const m of messages) {
    if (!m.attachments) continue;
    for (const a of m.attachments) {
      if (!a.content_type.startsWith("image/")) continue;
      out.push({
        hash: a.hash,
        content_type: a.content_type,
        filename: a.filename,
        date: m.date,
        contact_name: m.contact_name,
      });
    }
  }
  // Newest first — feels right for a gallery
  return out.sort((a, b) => b.date - a.date);
}

function fmtShortDate(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function Gallery({ messages }: { messages: Message[] }) {
  const items = useMemo(() => flattenImages(messages), [messages]);
  if (items.length === 0) {
    return (
      <div className="p-4 text-sm text-neutral-500 dark:text-neutral-400">
        No images in current selection.
      </div>
    );
  }
  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
        {items.map((it) => (
          <a
            key={`${it.hash}-${it.date}`}
            href={`/api/image/${it.hash}`}
            target="_blank"
            rel="noreferrer"
            title={`${it.contact_name || ""} · ${new Date(it.date).toLocaleString()}`}
            className="group flex flex-col"
          >
            <div className="aspect-square overflow-hidden rounded-md bg-neutral-200 dark:bg-neutral-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/image/${it.hash}`}
                alt={it.filename ?? ""}
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-150 group-hover:scale-[1.02]"
              />
            </div>
            <div className="mt-1 text-[11px] text-neutral-600 dark:text-neutral-400 tabular-nums text-center">
              {fmtShortDate(it.date)}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

function MessageRow({ m }: { m: Message }) {
  const isOut = m.type === 2;
  const bubble = isOut
    ? "bg-blue-500 text-white ml-auto"
    : "bg-neutral-200 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 mr-auto";
  const metaColor = isOut
    ? "text-blue-100"
    : "text-neutral-500 dark:text-neutral-400";
  return (
    <div className="py-1">
      <div className={`max-w-[70%] rounded-2xl px-3 py-2 text-sm ${bubble}`}>
        {!isOut && (
          <div className={`text-[10px] mb-0.5 ${metaColor}`}>
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
                  preload="none"
                />
              ) : a.content_type.startsWith("audio/") ? (
                <audio key={a.hash} src={`/api/image/${a.hash}`} controls preload="none" />
              ) : (
                <a
                  key={a.hash}
                  href={`/api/image/${a.hash}`}
                  className={`text-xs underline ${
                    isOut ? "text-blue-100" : "text-blue-700 dark:text-blue-400"
                  }`}
                >
                  {a.filename ?? a.content_type}
                </a>
              ),
            )}
          </div>
        )}
        <div className={`text-[10px] mt-1 ${metaColor}`}>
          {new Date(m.date).toLocaleString()}
        </div>
      </div>
    </div>
  );
}
