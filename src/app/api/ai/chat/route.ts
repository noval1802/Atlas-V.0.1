import { NextResponse } from "next/server";
import { currentUser } from "@/lib/ops/current-user";
import { isRateLimited } from "@/lib/ssrf-guard";
import { situationWhere } from "@/lib/ops/access";
import { opsDb } from "@/lib/ops/db";
import { chatReply, chatSystem, parseChatMessages } from "@/lib/ai-chat";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const UNAVAILABLE = "Asisten sedang tidak tersedia. Coba lagi nanti.";

// Hermes (docs/hermes-setup.md) picks the model; this route checks who may ask and attaches the situation rows they may see.
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Masuk diperlukan." }, { status: 401 });
  const base = process.env.HERMES_URL?.replace(/\/+$/, "");
  const key = process.env.HERMES_API_KEY;
  if (!base || !key) return NextResponse.json({ error: "Chat AI belum dikonfigurasi di server." }, { status: 503 });
  if (isRateLimited(`ai-chat:${user.id}`, 10)) return NextResponse.json({ error: "Terlalu banyak pesan. Coba lagi sebentar." }, { status: 429 });

  const messages = parseChatMessages(await request.json().catch(() => null));
  if (!messages) return NextResponse.json({ error: "Pesan tidak valid." }, { status: 400 });

  const rows = await opsDb().situation.findMany({
    where: situationWhere(user.role, user.kotamaopsId),
    include: { kotamaops: true },
    orderBy: { kotamaops: { code: "asc" } },
  });
  const system = chatSystem(rows.map((r) => ({ ...r.kotamaops, ...r })));

  let res: Response;
  try {
    res = await fetch(`${base}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: "hermes-agent", messages: [{ role: "system", content: system }, ...messages] }),
      signal: AbortSignal.timeout(110_000),
      cache: "no-store",
    });
  } catch (error) {
    console.error("[ai/chat] Hermes unreachable:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: UNAVAILABLE }, { status: 503 });
  }
  if (res.status === 429) return NextResponse.json({ error: "Layanan AI sedang sibuk. Coba lagi sebentar." }, { status: 503 });
  if (!res.ok) {
    console.error("[ai/chat] Hermes", res.status, (await res.text().catch(() => "")).slice(0, 300));
    return NextResponse.json({ error: "Layanan AI gagal menjawab." }, { status: 502 });
  }
  return NextResponse.json({ reply: chatReply(await res.json().catch(() => null)) });
}
