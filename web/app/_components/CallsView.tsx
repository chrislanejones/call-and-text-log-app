"use client";

import { useEffect, useState } from "react";
import type { Call } from "@/lib/types";

const TYPE_LABEL: Record<number, string> = {
  1: "Incoming",
  2: "Outgoing",
  3: "Missed",
  4: "Voicemail",
  5: "Rejected",
  6: "Blocked",
};

const TYPE_COLOR: Record<number, string> = {
  1: "text-green-700",
  2: "text-blue-700",
  3: "text-red-700",
  4: "text-purple-700",
  5: "text-orange-700",
  6: "text-neutral-500",
};

function fmtDuration(sec: number | null): string {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m ? `${m}m ${s}s` : `${s}s`;
}

function dateInputToMs(v: string): number | undefined {
  if (!v) return undefined;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : undefined;
}

export default function CallsView() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [q, setQ] = useState("");
  const [type, setType] = useState<string>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      const url = new URL("/api/calls", window.location.origin);
      if (q) url.searchParams.set("q", q);
      if (type) url.searchParams.set("type", type);
      const f = dateInputToMs(dateFrom);
      const te = dateInputToMs(dateTo);
      if (f) url.searchParams.set("dateFrom", String(f));
      if (te) url.searchParams.set("dateTo", String(te + 24 * 3600 * 1000 - 1));
      url.searchParams.set("limit", "1000");
      setLoading(true);
      fetch(url)
        .then((r) => r.json())
        .then((d) => setCalls(d.calls))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(t);
  }, [q, type, dateFrom, dateTo]);

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="border-b bg-white p-2 flex flex-wrap gap-2 items-center">
        <input
          type="search"
          placeholder="Search by name or number..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="flex-1 min-w-[200px] px-3 py-1.5 text-sm border rounded"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="px-2 py-1.5 text-sm border rounded"
        >
          <option value="">All types</option>
          <option value="1">Incoming</option>
          <option value="2">Outgoing</option>
          <option value="3">Missed</option>
          <option value="4">Voicemail</option>
          <option value="5">Rejected</option>
          <option value="6">Blocked</option>
        </select>
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
        <div className="text-xs text-neutral-500 ml-auto">
          {loading ? "Loading..." : `${calls.length.toLocaleString()} calls`}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-100 sticky top-0">
            <tr className="text-left">
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Contact</th>
              <th className="px-3 py-2">Number</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2 text-right">Duration</th>
            </tr>
          </thead>
          <tbody>
            {calls.map((c) => (
              <tr key={c.rowid} className="border-b hover:bg-neutral-50">
                <td className="px-3 py-1.5 text-neutral-600 whitespace-nowrap">
                  {new Date(c.date).toLocaleString()}
                </td>
                <td className="px-3 py-1.5">{c.contact_name || "—"}</td>
                <td className="px-3 py-1.5 font-mono text-xs">{c.number}</td>
                <td className={`px-3 py-1.5 ${TYPE_COLOR[c.type ?? -1] ?? ""}`}>
                  {TYPE_LABEL[c.type ?? -1] ?? c.type}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {fmtDuration(c.duration)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && calls.length === 0 && (
          <div className="p-4 text-sm text-neutral-500">No calls.</div>
        )}
      </div>
    </div>
  );
}
