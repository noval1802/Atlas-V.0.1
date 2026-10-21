import { sessionMatchesUser } from "./access";
import { opsDb } from "./db";
import { readSession } from "./session";

/** Akun, sandi, dan webhook yang memang dipanggil tanpa sesi. */
const PUBLIC_API = new Set([
  "/api/health",
  "/api/ops/login",
  "/api/ops/logout",
  "/api/ops/register",
  "/api/ops/password/forgot",
  "/api/ops/password/reset",
  "/api/github-webhook",
]);

/**
 * True when this request must stay reachable without an OSIRIS session.
 * SDK ingest POST carries its own key. The GET on that path lists entities and stays closed.
 */
export function isPublicApi(pathname: string, method: string): boolean {
  if (PUBLIC_API.has(pathname)) return true;
  return pathname === "/api/sdk/ingest" && method.toUpperCase() === "POST";
}

/** User administration and the CCTV token store. Situation writes are not in this list. */
export function isAdminApi(pathname: string): boolean {
  return (
    pathname === "/api/ops/users" ||
    pathname.startsWith("/api/ops/users/") ||
    pathname === "/api/ops/audit" ||
    pathname.startsWith("/api/ops/audit/") ||
    pathname === "/api/cctv/tokens" ||
    pathname.startsWith("/api/cctv/tokens/")
  );
}

export type SessionAccount = { id: string; role: string; kotamaopsId: string | null };

/** Signed cookie plus the live account. Inactive, pending, and revoked sessions return null. */
export async function sessionAccount(token: string | undefined): Promise<SessionAccount | null> {
  const session = await readSession(token, process.env.OPS_SESSION_SECRET ?? "");
  if (!session) return null;
  try {
    const user = await opsDb().user.findUnique({
      where: { id: session.sub },
      select: { id: true, role: true, kotamaopsId: true, active: true, accountStatus: true, sessionVersion: true },
    });
    if (!user || !sessionMatchesUser(session, user)) return null;
    return { id: user.id, role: user.role, kotamaopsId: user.kotamaopsId };
  } catch {
    return null;
  }
}

/** Halaman monitoring dan dasbor operasional. Aset statis tidak lewat sini. */
export function isProtectedPage(pathname: string): boolean {
  return (
    pathname === "/peta" ||
    pathname.startsWith("/peta/") ||
    pathname === "/operator" ||
    pathname.startsWith("/operator/") ||
    pathname === "/pengguna" ||
    pathname.startsWith("/pengguna/")
  );
}

/** Signed cookie plus the live account row. A bumped session version or a disabled account fails closed. */
export async function liveSession(token: string | undefined): Promise<boolean> {
  return (await sessionAccount(token)) !== null;
}
