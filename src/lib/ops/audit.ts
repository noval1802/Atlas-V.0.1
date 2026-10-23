import { opsDb } from "./db";

const SECRET = /scrypt\$\S+|bearer\s+\S+|osiris_ops=\S+/gi;

export function scrubDetail(value: string): string {
  return value.replace(SECRET, "[redacted]").replace(/[\r\n]/g, " ").slice(0, 300);
}

export function requestIp(request: Request): string {
  // X-Real-IP is overwritten by our nginx with the socket peer, and the rightmost
  // X-Forwarded-For hop is what the nearest proxy saw. The leftmost hop is written
  // by the client, so trusting it let one caller rotate through endless rate-limit buckets.
  const chain = (request.headers.get("x-forwarded-for") ?? "").split(",").map((hop) => hop.trim()).filter(Boolean);
  const candidate = request.headers.get("x-real-ip")?.trim() || chain[chain.length - 1] || "";
  if (!/^[0-9a-fA-F:.]+$/.test(candidate) || candidate.length > 64) return "";
  return candidate;
}

export async function writeAudit(entry: {
  action: string;
  result: string;
  actorId?: string | null;
  targetId?: string | null;
  ip?: string;
  detail?: string;
}): Promise<void> {
  try {
    await opsDb().authAudit.create({
      data: {
        action: entry.action.slice(0, 80),
        result: entry.result.slice(0, 80),
        actorId: entry.actorId || null,
        targetId: entry.targetId || null,
        ip: (entry.ip ?? "").slice(0, 64),
        detail: scrubDetail(entry.detail ?? ""),
      },
    });
  } catch {
    console.error("auth audit failed", entry.action);
  }
}
