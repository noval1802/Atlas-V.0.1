import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requestIp, writeAudit } from "@/lib/ops/audit";
import { opsDb } from "@/lib/ops/db";
import { OPS_COOKIE, clearSessionCookie, readSession, sessionSecret } from "@/lib/ops/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = sessionSecret();
  const token = (await cookies()).get(OPS_COOKIE)?.value;
  const session = await readSession(token, secret);
  if (session) {
    const user = await opsDb().user.findUnique({ where: { id: session.sub } });
    if (user && (session.ver ?? 0) === user.sessionVersion) {
      await opsDb().user.update({ where: { id: user.id }, data: { sessionVersion: { increment: 1 } } });
      await writeAudit({ action: "logout", result: "ok", actorId: user.id, targetId: user.id, ip: requestIp(request) });
    }
  }
  const response = NextResponse.json({ ok: true });
  response.headers.set("Set-Cookie", clearSessionCookie());
  return response;
}
