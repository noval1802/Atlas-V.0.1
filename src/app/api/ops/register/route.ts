import { NextResponse } from "next/server";
import { parseRegister, registrationRole } from "@/lib/ops/access";
import { requestIp, writeAudit } from "@/lib/ops/audit";
import { opsDb } from "@/lib/ops/db";
import { hashPassword } from "@/lib/ops/password";
import { rateLimit } from "@/lib/ops/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const ip = requestIp(request);
  if (!rateLimit(`register:${ip || "unknown"}`, 5, 60 * 60 * 1000).ok) {
    return NextResponse.json({ error: "Terlalu banyak percobaan. Coba lagi nanti." }, { status: 429 });
  }
  const parsed = parseRegister(await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  // Taken names and emails get the same 201 as a new account, so the form cannot list who exists.
  const passwordHash = await hashPassword(parsed.value.password);
  const taken = await opsDb().user.findFirst({
    where: { OR: [{ username: parsed.value.username }, { email: parsed.value.email }] },
    select: { id: true },
  });
  if (taken) {
    await writeAudit({ action: "register", result: "duplicate", targetId: taken.id, ip, detail: "nama pengguna atau email sudah terdaftar" });
  } else {
    const created = await opsDb().user.create({
      data: {
        name: parsed.value.name,
        username: parsed.value.username,
        email: parsed.value.email,
        organization: parsed.value.organization,
        position: parsed.value.position,
        passwordHash,
        role: registrationRole(),
        active: false,
        accountStatus: "PENDING",
      },
    });
    await writeAudit({
      action: "register",
      result: "pending",
      targetId: created.id,
      ip,
      detail: "akun menunggu persetujuan",
    });
  }
  return NextResponse.json(
    { ok: true, message: "Pendaftaran diterima. Akun menunggu persetujuan Admin." },
    { status: 201 },
  );
}
