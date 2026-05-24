import { NextRequest, NextResponse } from "next/server";
import { listCalls } from "@/lib/queries";

export const dynamic = "force-dynamic";

function num(v: string | null): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const calls = listCalls({
    q: sp.get("q") || undefined,
    type: num(sp.get("type")),
    dateFrom: num(sp.get("dateFrom")),
    dateTo: num(sp.get("dateTo")),
    limit: num(sp.get("limit")) ?? 500,
    offset: num(sp.get("offset")) ?? 0,
  });
  return NextResponse.json({ calls });
}
