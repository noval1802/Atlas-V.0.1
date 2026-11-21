import { randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

// .cache is the app's writable, persisted dir (Docker: atlas-app-cache volume).
// shortcut: logos share the cache volume, move to a dedicated volume if .cache is ever wiped on deploy.
export const LOGO_DIR = path.join(process.cwd(), ".cache", "kotamaops-logo");
export const LOGO_PREFIX = "/api/ops/kotamaops/logo/";
export const LOGO_MAX_BYTES = 512 * 1024;
const LOGO_FILE = /^[a-z0-9-]+\.(png|jpg|webp)$/;

export const LOGO_TYPES = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" } as const;
export type LogoKind = keyof typeof LOGO_TYPES;

/** Kind from the file's own bytes; the browser-sent type and name are not trusted. */
export function sniffLogo(bytes: Uint8Array): LogoKind | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  return null;
}

/** Name of a stored logo inside LOGO_DIR, or null for anything that is not one. */
export function logoFileName(name: string): string | null {
  return LOGO_FILE.test(name) ? name : null;
}

export async function checkLogo(file: File): Promise<{ ok: true; bytes: Uint8Array; kind: LogoKind } | { ok: false; error: string }> {
  if (file.size > LOGO_MAX_BYTES) return { ok: false, error: "Logo maksimal 512 KB." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffLogo(bytes);
  if (!kind) return { ok: false, error: "Logo harus berkas PNG, JPG, atau WebP." };
  return { ok: true, bytes, kind };
}

/** Writes a checked logo and returns the URL stored in Kotamaops.logo. */
export async function storeLogo(code: string, bytes: Uint8Array, kind: LogoKind): Promise<string> {
  const slug = code.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "satuan";
  const name = `${slug}-${randomBytes(4).toString("hex")}.${kind}`;
  await mkdir(LOGO_DIR, { recursive: true });
  await writeFile(path.join(LOGO_DIR, name), bytes);
  return `${LOGO_PREFIX}${name}`;
}

/** Removes an uploaded logo. Built-in /kodam/ crests and unknown values are left alone. */
export async function discardLogo(url: string): Promise<void> {
  if (!url.startsWith(LOGO_PREFIX)) return;
  const name = logoFileName(url.slice(LOGO_PREFIX.length));
  if (!name) return;
  await unlink(path.join(LOGO_DIR, name)).catch(() => undefined);
}

export async function readLogo(name: string): Promise<{ bytes: Buffer; type: string } | null> {
  const safe = logoFileName(name);
  if (!safe) return null;
  try {
    const bytes = await readFile(path.join(LOGO_DIR, safe));
    return { bytes, type: LOGO_TYPES[safe.split(".").pop() as LogoKind] };
  } catch {
    return null;
  }
}
