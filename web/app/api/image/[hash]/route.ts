import { NextRequest } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { getDb, IMAGES_DIR } from "@/lib/db";

export const dynamic = "force-dynamic";

const EXT_FOR_CT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/bmp": "bmp",
  "video/mp4": "mp4",
  "video/3gpp": "3gp",
  "video/quicktime": "mov",
  "audio/amr": "amr",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/aac": "m4a",
  "audio/mp4": "m4a",
  "audio/ogg": "ogg",
};

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ hash: string }> },
) {
  const { hash } = await ctx.params;
  if (!/^[a-f0-9]{64}$/.test(hash)) {
    return new Response("bad hash", { status: 400 });
  }

  const db = getDb();
  const row = db
    .prepare("SELECT content_type FROM attachments WHERE hash = ? LIMIT 1")
    .get(hash) as { content_type: string } | undefined;
  if (!row) return new Response("not found", { status: 404 });

  const ext = EXT_FOR_CT[row.content_type.toLowerCase()] ?? "bin";
  const shard = hash.slice(0, 2);
  const file = path.join(IMAGES_DIR, shard, `${hash}.${ext}`);

  let stat: fs.Stats;
  try {
    stat = await fs.promises.stat(file);
  } catch {
    return new Response("not found", { status: 404 });
  }

  const stream = fs.createReadStream(file);
  return new Response(stream as unknown as ReadableStream, {
    headers: {
      "content-type": row.content_type,
      "content-length": String(stat.size),
      "cache-control": "private, max-age=31536000, immutable",
    },
  });
}
