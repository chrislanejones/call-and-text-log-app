import { NextResponse } from "next/server";
import { getStats } from "@/lib/queries";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(getStats());
}
