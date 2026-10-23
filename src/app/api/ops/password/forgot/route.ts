import { NextResponse } from "next/server";
import { emailError } from "@/lib/ops/access";
import { requestIp, writeAudit } from "@/lib/ops/audit";
import { opsDb } from "@/lib/ops/db";
import { resetMessage, resetOrigin, sendAuthMail, smtpConfigured } from "@/lib/ops/mail";
import { rateLimit } from "@/lib/ops/rate-limit";
import { PUBLIC_RESET_MESSAGE, RESET_TTL_MS, newResetToken } from "@/lib/ops/reset-token";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const ip = requestIp(request);
  let email = "";
  try {
    const body = await request.json();
    email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  } catch {
    email = "";
  }
  if (emailError(email)) return NextResponse.json({ error: "Email tidak valid." }, { status: 400 });
  if (!rateLimit(`reset-ip:${ip || "unknown"}`, 5, 60 * 60 * 1000).ok || !rateLimit(`reset-email:${email}`, 5, 60 * 60 * 1000).ok) {
    return NextResponse.json({ error: "Terlalu banyak permintaan. Coba lagi nanti." }, { status: 429 });
  }
  const user = await opsDb().user.findUnique({ where: { email } });
  if (!user || (user.accountStatus !== "ACTIVE" && user.accountStatus !== "PENDING")) {
    await writeAudit({ action: "password_reset_request", result: user ? "not_active" : "unknown", targetId: user?.id, ip });
    return NextResponse.json({ ok: true, message: PUBLIC_RESET_MESSAGE });
  }
  const origin = resetOrigin();
  if (!origin || !smtpConfigured()) {
    await writeAudit({
      action: "password_reset_request",
      result: smtpConfigured() ? "no_origin" : "unconfigured",
      targetId: user.id,
      ip,
    });
    return NextResponse.json({ ok: true, message: PUBLIC_RESET_MESSAGE });
  }
  const { token, tokenHash } = newResetToken();
  const link = `${origin}/atur-sandi?token=${encodeURIComponent(token)}`;
  const message = resetMessage(link);
  const sent = await sendAuthMail({ to: email, subject: message.subject, text: message.text });
  if (!sent.ok) {
    await writeAudit({ action: "password_reset_request", result: "mail_failed", targetId: user.id, ip, detail: sent.error });
    return NextResponse.json({ ok: true, message: PUBLIC_RESET_MESSAGE });
  }
  await opsDb().passwordReset.deleteMany({ where: { userId: user.id, usedAt: null } });
  await opsDb().passwordReset.create({
    data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + RESET_TTL_MS) },
  });
  await writeAudit({ action: "password_reset_request", result: "sent", targetId: user.id, ip });
  return NextResponse.json({ ok: true, message: PUBLIC_RESET_MESSAGE });
}
