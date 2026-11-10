import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/ops/current-user";
import { isRateLimited } from "@/lib/ssrf-guard";
import { CHAT_SYSTEM, parseChatMessages } from "@/lib/ai-chat";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Masuk diperlukan." }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "Chat AI belum dikonfigurasi di server." }, { status: 503 });
  if (isRateLimited(`ai-chat:${user.id}`, 10)) return NextResponse.json({ error: "Terlalu banyak pesan. Coba lagi sebentar." }, { status: 429 });

  const messages = parseChatMessages(await request.json().catch(() => null));
  if (!messages) return NextResponse.json({ error: "Pesan tidak valid." }, { status: 400 });

  try {
    const response = await new Anthropic().beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      output_config: { effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: CHAT_SYSTEM,
      messages,
    });
    if (response.stop_reason === "refusal") {
      return NextResponse.json({ reply: "Maaf, permintaan ini tidak dapat dijawab." });
    }
    const reply = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("").trim();
    return NextResponse.json({ reply: reply || "Tidak ada jawaban." });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Layanan AI sedang sibuk. Coba lagi sebentar." }, { status: 503 });
    }
    if (error instanceof Anthropic.APIError) {
      console.error("[ai/chat]", error.status, error.message);
      return NextResponse.json({ error: "Layanan AI gagal menjawab." }, { status: 502 });
    }
    throw error;
  }
}
