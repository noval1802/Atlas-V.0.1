import { NextResponse } from "next/server";
import { readLogo } from "@/lib/ops/kotamaops-logo";

export const dynamic = "force-dynamic";

// Login is enforced by src/proxy.ts for every /api path; any signed-in role may see a crest.
export async function GET(_request: Request, context: { params: Promise<{ file: string }> }) {
  const { file } = await context.params;
  const logo = await readLogo(file);
  if (!logo) return NextResponse.json({ error: "Logo tidak ditemukan." }, { status: 404 });
  return new NextResponse(new Uint8Array(logo.bytes), {
    headers: {
      "Content-Type": logo.type,
      // File names carry a random suffix and are never rewritten, so the bytes behind a URL never change.
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
