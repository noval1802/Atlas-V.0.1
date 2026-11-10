import type Anthropic from "@anthropic-ai/sdk";

const MAX_TURNS = 20;
const MAX_CHARS = 2000;

// The model sees only what the operator types here; no situation data is attached.
export const CHAT_SYSTEM = `Anda adalah asisten ATLAS untuk operator Pusdalops TNI. Jawab dalam bahasa Indonesia, singkat dan jelas.
Anda tidak punya akses ke data operasional, peta, CCTV, atau laporan situasi di ATLAS. Jangan mengarang angka, lokasi, atau kejadian; bila ditanya data langsung, arahkan operator ke Peta situasi atau dashboard.`;

export function parseChatMessages(body: unknown): Anthropic.Beta.BetaMessageParam[] | null {
  const list = (body as { messages?: unknown } | null)?.messages;
  if (!Array.isArray(list) || list.length === 0 || list.length > MAX_TURNS) return null;
  const out: Anthropic.Beta.BetaMessageParam[] = [];
  for (const m of list) {
    const role = (m as { role?: unknown })?.role;
    const content = (m as { content?: unknown })?.content;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") return null;
    const text = content.trim();
    if (!text || text.length > MAX_CHARS) return null;
    out.push({ role, content: text });
  }
  return out[0].role === "user" && out[out.length - 1].role === "user" ? out : null;
}
