import { NextRequest, NextResponse } from "next/server";
import { listConversations } from "@/lib/queries";

export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") || undefined;
  const limit = Number(url.searchParams.get("limit") ?? 200);
  const rows = listConversations({ q, limit });
  return NextResponse.json({ conversations: rows });
}
