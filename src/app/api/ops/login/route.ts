import { NextResponse } from "next/server";
import { allowedNext, homeForRole } from "@/lib/ops/access";
import { requestIp, writeAudit } from "@/lib/ops/audit";
import { opsDb } from "@/lib/ops/db";
import { DUMMY_PASSWORD_HASH, verifyPassword } from "@/lib/ops/password";
import { rateLimit } from "@/lib/ops/rate-limit";
import { REMEMBER_MS, SESSION_MS, issueSession, sessionCookie, sessionSecret } from "@/lib/ops/session";

export const dynamic = "force-dynamic";

const INVALID = "Nama pengguna atau kata sandi salah.";
const WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: Request) {
  const secret = sessionSecret();
  if (!secret) return NextResponse.json({ error: "Sesi belum dikonfigurasi." }, { status: 500 });
  const ip = requestIp(request);
  let body: { username?: unknown; password?: unknown; remember?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: INVALID }, { status: 401 });
  }
  const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  // The per-account bucket ignores the IP, so spoofing or rotating addresses buys no extra guesses.
  if (
    !rateLimit(`login-ip:${ip || "unknown"}`, 30, WINDOW_MS).ok ||
    !rateLimit(`login:${ip || "unknown"}:${username}`, 8, WINDOW_MS).ok ||
    !rateLimit(`login-user:${username}`, 20, WINDOW_MS).ok
  ) {
    /* Not written to the audit table: the limiter refuses the login but would
       still add one row per request, so a loop could flood the table and push
       real admin actions out of the 80-row view. The failures that tripped the
       limit are already audited. */
    console.warn(`[ops] login rate limited: ip=${ip || "unknown"}`);
    return NextResponse.json({ error: "Terlalu banyak percobaan. Coba lagi nanti." }, { status: 429 });
  }
  const user = username ? await opsDb().user.findUnique({ where: { username } }) : null;
  const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
  if (!user || !valid) {
    await writeAudit({
      action: "login_failure",
      result: "denied",
      targetId: user?.id,
      ip,
      detail: user ? "kata sandi salah" : "akun tidak dikenal",
    });
    return NextResponse.json({ error: INVALID }, { status: 401 });
  }
  if (!user.active || user.accountStatus !== "ACTIVE") {
    await writeAudit({ action: "login_failure", result: "inactive", actorId: user.id, targetId: user.id, ip, detail: user.accountStatus });
    return NextResponse.json({ error: "Akun belum dapat masuk. Menunggu persetujuan atau tidak aktif." }, { status: 403 });
  }
  await opsDb().user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const remember = body.remember === true;
  const lifetime = remember ? REMEMBER_MS : SESSION_MS;
  const token = await issueSession(user.id, secret, Date.now(), { remember, version: user.sessionVersion });
  await writeAudit({ action: "login_success", result: "ok", actorId: user.id, targetId: user.id, ip, detail: remember ? "remember" : "session" });
  const response = NextResponse.json({ ok: true, role: user.role, home: homeForRole(user.role), allowed: allowedNext(user.role) });
  response.headers.set("Set-Cookie", sessionCookie(token, lifetime / 1000));
  return response;
}
