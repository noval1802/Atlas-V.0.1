import { createHash, randomBytes } from "node:crypto";

export const RESET_TTL_MS = 30 * 60 * 1000;

export const PUBLIC_RESET_MESSAGE =
  "Jika email terdaftar dan layanan surel tersedia, tautan reset dikirim. Jika pesan tidak datang, periksa alamat atau konfigurasi surel.";

export function newResetToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashResetToken(token) };
}

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

export function tokenError(token: string): string | null {
  if (!/^[A-Za-z0-9_-]{40,80}$/.test(token)) return "Tautan reset tidak berlaku.";
  return null;
}

export function assessReset(
  row: { usedAt: Date | null; expiresAt: Date } | null,
  now: number,
): "missing" | "used" | "expired" | "ok" {
  if (!row) return "missing";
  if (row.usedAt) return "used";
  if (row.expiresAt.getTime() <= now) return "expired";
  return "ok";
}

export function resetFailureMessage(state: "missing" | "used" | "expired"): string {
  if (state === "used") return "Tautan reset sudah dipakai.";
  if (state === "expired") return "Tautan reset sudah kedaluwarsa.";
  return "Tautan reset tidak berlaku.";
}
