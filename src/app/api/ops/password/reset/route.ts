import { NextResponse } from "next/server";
import { passwordError } from "@/lib/ops/access";
import { requestIp, writeAudit } from "@/lib/ops/audit";
import { opsDb } from "@/lib/ops/db";
import { hashPassword } from "@/lib/ops/password";
import { rateLimit } from "@/lib/ops/rate-limit";
import { assessReset, hashResetToken, resetFailureMessage, tokenError } from "@/lib/ops/reset-token";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const ip = requestIp(request);
  if (!rateLimit(`reset-complete:${ip || "unknown"}`, 10, 60 * 60 * 1000).ok) {
    return NextResponse.json({ error: "Terlalu banyak percobaan. Coba lagi nanti." }, { status: 429 });
  }
  let token = "";
  let password = "";
  let confirm = "";
  try {
    const body = await request.json();
    token = typeof body.token === "string" ? body.token : "";
    password = typeof body.password === "string" ? body.password : "";
    confirm = typeof body.confirmPassword === "string" ? body.confirmPassword : "";
  } catch {
    return NextResponse.json({ error: "Tautan reset tidak berlaku." }, { status: 400 });
  }
  if (tokenError(token)) return NextResponse.json({ error: "Tautan reset tidak berlaku." }, { status: 400 });
  const passwordProblem = passwordError(password);
  if (passwordProblem) return NextResponse.json({ error: passwordProblem }, { status: 400 });
  if (password !== confirm) return NextResponse.json({ error: "Konfirmasi kata sandi tidak sama." }, { status: 400 });
  const row = await opsDb().passwordReset.findUnique({ where: { tokenHash: hashResetToken(token) }, include: { user: true } });
  const state = assessReset(row, Date.now());
  if (!row || state !== "ok") {
    await writeAudit({ action: "password_reset_complete", result: state, targetId: row?.userId, ip });
    return NextResponse.json({ error: resetFailureMessage(state === "ok" ? "missing" : state) }, { status: 400 });
  }
  const passwordHash = await hashPassword(password);
  await opsDb().$transaction(async (tx) => {
    await tx.user.update({
      where: { id: row.userId },
      data: { passwordHash, sessionVersion: { increment: 1 } },
    });
    await tx.passwordReset.update({ where: { id: row.id }, data: { usedAt: new Date() } });
    await tx.passwordReset.deleteMany({ where: { userId: row.userId, usedAt: null } });
  });
  await writeAudit({ action: "password_reset_complete", result: "ok", targetId: row.userId, ip });
  return NextResponse.json({ ok: true, message: "Kata sandi diperbarui. Masuk dengan kata sandi baru." });
}
