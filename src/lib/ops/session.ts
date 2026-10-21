export const OPS_COOKIE = "osiris_ops";
export const SESSION_MS = 8 * 60 * 60 * 1000;
export const REMEMBER_MS = 14 * 24 * 60 * 60 * 1000;

type SessionPayload = { sub: string; exp: number; ver?: number };

function encode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function encodeText(value: string): string {
  return encode(new TextEncoder().encode(value));
}

async function sign(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return encode(new Uint8Array(signature));
}

function sameText(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return diff === 0;
}

export async function issueSession(
  userId: string,
  secret: string,
  now = Date.now(),
  options?: { remember?: boolean; version?: number },
): Promise<string> {
  const lifetime = options?.remember ? REMEMBER_MS : SESSION_MS;
  const payload = encodeText(JSON.stringify({
    sub: userId,
    exp: now + lifetime,
    ver: options?.version ?? 0,
  } satisfies SessionPayload));
  return `${payload}.${await sign(payload, secret)}`;
}

function decode(value: string): Uint8Array {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export async function readSession(token: string | undefined, secret: string, now = Date.now()): Promise<SessionPayload | null> {
  if (!token || !secret) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;
  const expected = await sign(payload, secret);
  if (!sameText(signature, expected)) return null;
  try {
    const json = JSON.parse(new TextDecoder().decode(decode(payload))) as SessionPayload;
    if (typeof json.sub !== "string" || !json.sub || typeof json.exp !== "number" || json.exp <= now) return null;
    if (json.ver !== undefined && (!Number.isInteger(json.ver) || json.ver < 0)) return null;
    return json;
  } catch {
    return null;
  }
}

export function sessionCookie(token: string, maxAgeSeconds: number): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const age = Math.max(1, Math.floor(maxAgeSeconds));
  return `${OPS_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${age}${secure}`;
}

export function clearSessionCookie(): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${OPS_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`;
}
