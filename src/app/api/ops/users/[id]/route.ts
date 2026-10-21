import { NextResponse } from "next/server";
import { canManageUsers, nextAccountState, parseUserPatch, superAdminRoleChangeError } from "@/lib/ops/access";
import { requestIp, writeAudit } from "@/lib/ops/audit";
import { currentUser, presentUser } from "@/lib/ops/current-user";
import { opsDb } from "@/lib/ops/db";
import { hashPassword } from "@/lib/ops/password";

export const dynamic = "force-dynamic";

function statusAction(before: string, after: string): string | null {
  if (before === after) return null;
  if (before === "PENDING" && after === "ACTIVE") return "account_approve";
  if (after === "REJECTED") return "account_reject";
  if (after === "DISABLED") return "account_disable";
  if (after === "ACTIVE") return "account_enable";
  return "account_status";
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await currentUser();
  if (!actor) return NextResponse.json({ error: "Masuk diperlukan." }, { status: 401 });
  if (!canManageUsers(actor.role)) return NextResponse.json({ error: "Peran ini tidak mengatur pengguna." }, { status: 403 });
  const { id } = await context.params;
  const existing = await opsDb().user.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Pengguna tidak ditemukan." }, { status: 404 });
  const parsed = parseUserPatch(await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const role = parsed.value.role ?? existing.role;
  const roleChange = superAdminRoleChangeError(actor.role, existing.role, role);
  if (roleChange) return NextResponse.json({ error: roleChange }, { status: 403 });
  const account = nextAccountState(existing, parsed.value);
  const kotamaopsId = role === "OPERATOR_KODAM" ? (parsed.value.kotamaopsId === undefined ? existing.kotamaopsId : parsed.value.kotamaopsId) : null;
  if (role === "OPERATOR_KODAM" && !kotamaopsId) {
    return NextResponse.json({ error: "Operator Kodam wajib diikat ke satu Kotamaops." }, { status: 400 });
  }
  if (kotamaopsId) {
    const unit = await opsDb().kotamaops.findUnique({ where: { id: kotamaopsId } });
    if (!unit) return NextResponse.json({ error: "Kotamaops tidak ditemukan." }, { status: 400 });
  }
  const removesLastAdmin = existing.role === "SUPER_ADMIN" && existing.active && existing.accountStatus === "ACTIVE" && (role !== "SUPER_ADMIN" || !account.active);
  if (removesLastAdmin) {
    const others = await opsDb().user.count({
      where: { role: "SUPER_ADMIN", active: true, accountStatus: "ACTIVE", id: { not: existing.id } },
    });
    if (others === 0) return NextResponse.json({ error: "Super admin aktif terakhir tidak dapat diturunkan." }, { status: 400 });
  }
  const lockSession = Boolean(parsed.value.password) || (existing.accountStatus === "ACTIVE" && account.accountStatus !== "ACTIVE");
  const saved = await opsDb().user.update({
    where: { id },
    data: {
      name: parsed.value.name,
      role,
      active: account.active,
      accountStatus: account.accountStatus,
      kotamaopsId,
      passwordHash: parsed.value.password ? await hashPassword(parsed.value.password) : undefined,
      sessionVersion: lockSession ? { increment: 1 } : undefined,
    },
    include: { kotamaops: true },
  });
  const ip = requestIp(request);
  if (role !== existing.role) {
    await writeAudit({
      action: "role_change",
      result: "ok",
      actorId: actor.id,
      targetId: existing.id,
      ip,
      detail: `${existing.role} -> ${role}`,
    });
  }
  const action = statusAction(existing.accountStatus, account.accountStatus);
  if (action) {
    await writeAudit({
      action,
      result: "ok",
      actorId: actor.id,
      targetId: existing.id,
      ip,
      detail: `${existing.accountStatus} -> ${account.accountStatus}`,
    });
  }
  if (parsed.value.password) {
    await writeAudit({ action: "password_change", result: "ok", actorId: actor.id, targetId: existing.id, ip });
  }
  return NextResponse.json(presentUser(saved));
}
