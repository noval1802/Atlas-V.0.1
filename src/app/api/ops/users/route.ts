import { NextResponse } from "next/server";
import { canManageUsers, parseNewUser, superAdminRoleChangeError } from "@/lib/ops/access";
import { requestIp, writeAudit } from "@/lib/ops/audit";
import { currentUser, presentUser } from "@/lib/ops/current-user";
import { opsDb } from "@/lib/ops/db";
import { hashPassword } from "@/lib/ops/password";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await currentUser();
  if (!actor) return NextResponse.json({ error: "Masuk diperlukan." }, { status: 401 });
  if (!canManageUsers(actor.role)) return NextResponse.json({ error: "Peran ini tidak mengatur pengguna." }, { status: 403 });
  const [users, kotamaops] = await Promise.all([
    opsDb().user.findMany({ include: { kotamaops: true }, orderBy: { username: "asc" } }),
    opsDb().kotamaops.findMany({ orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }),
  ]);
  return NextResponse.json({ users: users.map(presentUser), kotamaops });
}

export async function POST(request: Request) {
  const actor = await currentUser();
  if (!actor) return NextResponse.json({ error: "Masuk diperlukan." }, { status: 401 });
  if (!canManageUsers(actor.role)) return NextResponse.json({ error: "Peran ini tidak mengatur pengguna." }, { status: 403 });
  const parsed = parseNewUser(await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const roleChange = superAdminRoleChangeError(actor.role, null, parsed.value.role);
  if (roleChange) return NextResponse.json({ error: roleChange }, { status: 403 });
  if (parsed.value.kotamaopsId) {
    const unit = await opsDb().kotamaops.findUnique({ where: { id: parsed.value.kotamaopsId } });
    if (!unit) return NextResponse.json({ error: "Kotamaops tidak ditemukan." }, { status: 400 });
  }
  const taken = await opsDb().user.findUnique({ where: { username: parsed.value.username } });
  if (taken) return NextResponse.json({ error: "Nama pengguna sudah dipakai." }, { status: 409 });
  const created = await opsDb().user.create({
    data: {
      name: parsed.value.name,
      username: parsed.value.username,
      passwordHash: await hashPassword(parsed.value.password),
      role: parsed.value.role,
      kotamaopsId: parsed.value.kotamaopsId,
      active: true,
      accountStatus: "ACTIVE",
    },
    include: { kotamaops: true },
  });
  await writeAudit({
    action: "account_create",
    result: "ok",
    actorId: actor.id,
    targetId: created.id,
    ip: requestIp(request),
    detail: parsed.value.role,
  });
  return NextResponse.json(presentUser(created), { status: 201 });
}
