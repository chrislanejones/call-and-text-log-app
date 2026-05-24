import { NextRequest, NextResponse } from "next/server";
import { countMessages, listMessages } from "@/lib/queries";
import type { MessageFilters } from "@/lib/types";

export const dynamic = "force-dynamic";

function num(v: string | null): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function GET(req: NextRequest) {
  const url = new URL(req.url);
  const sp = url.searchParams;
  const filters: MessageFilters = {
    q: sp.get("q") || undefined,
    conversation: sp.get("conversation") || undefined,
    contact: sp.get("contact") || undefined,
    number: sp.get("number") || undefined,
    hasImages: sp.get("hasImages") === "1",
    type: num(sp.get("type")),
    dateFrom: num(sp.get("dateFrom")),
    dateTo: num(sp.get("dateTo")),
    limit: num(sp.get("limit")) ?? 50000,
    offset: num(sp.get("offset")) ?? 0,
  };
  const messages = listMessages(filters);
  const total = countMessages(filters);
  return NextResponse.json({ messages, total });
}
