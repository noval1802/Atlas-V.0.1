import { NextResponse } from "next/server";
import { canAddKotamaops, canDeleteKotamaops, parseNewKotamaops } from "@/lib/ops/access";
import { requestIp, writeAudit } from "@/lib/ops/audit";
import { currentUser } from "@/lib/ops/current-user";
import { opsDb } from "@/lib/ops/db";
import { presentSituation, presentUnit, readUnitForm } from "@/lib/ops/kotamaops-admin";
import { discardLogo, storeLogo } from "@/lib/ops/kotamaops-logo";

export const dynamic = "force-dynamic";

const withSituation = { situation: true, _count: { select: { users: true } } } as const;

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Masuk diperlukan." }, { status: 401 });
  if (!canAddKotamaops(user.role)) return NextResponse.json({ error: "Peran ini tidak dapat mengubah Kotamaops." }, { status: 403 });
  const { id } = await context.params;
  const existing = await opsDb().kotamaops.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Kotamaops tidak ditemukan." }, { status: 404 });

  const form = await readUnitForm(request);
  if (!form.ok) return NextResponse.json({ error: form.error }, { status: 400 });
  const parsed = parseNewKotamaops(form.fields);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (parsed.value.code !== existing.code) {
    const taken = await opsDb().kotamaops.findUnique({ where: { code: parsed.value.code } });
    if (taken) return NextResponse.json({ error: `Kode ${parsed.value.code} sudah dipakai.` }, { status: 409 });
  }

  const logo = form.logo
    ? await storeLogo(parsed.value.code, form.logo.bytes, form.logo.kind)
    : form.removeLogo
      ? ""
      : existing.logo;
  let unit;
  try {
    unit = await opsDb().kotamaops.update({ where: { id }, data: { ...parsed.value, logo }, include: withSituation });
  } catch (error) {
    if (logo !== existing.logo) await discardLogo(logo);
    throw error;
  }
  if (logo !== existing.logo) await discardLogo(existing.logo);
  await writeAudit({
    action: "kotamaops_update",
    result: "ok",
    actorId: user.id,
    ip: requestIp(request),
    detail: existing.code === unit.code ? unit.code : `${existing.code} → ${unit.code}`,
  });
  return NextResponse.json({
    unit: presentUnit(unit),
    row: unit.situation ? presentSituation({ ...unit.situation, kotamaops: unit }) : null,
  });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Masuk diperlukan." }, { status: 401 });
  if (!canDeleteKotamaops(user.role)) return NextResponse.json({ error: "Hanya admin yang dapat menghapus Kotamaops." }, { status: 403 });
  const { id } = await context.params;
  const existing = await opsDb().kotamaops.findUnique({ where: { id }, include: withSituation });
  if (!existing) return NextResponse.json({ error: "Kotamaops tidak ditemukan." }, { status: 404 });
  // Deleting would silently unbind these Kodam operators and leave them with an empty dashboard.
  if (existing._count.users > 0) {
    return NextResponse.json(
      { error: `${existing._count.users} akun masih terikat ke ${existing.code}. Pindahkan akun itu di Manajemen pengguna dulu.` },
      { status: 409 },
    );
  }
  // Situation and SituationRevision rows go with it (onDelete: Cascade).
  await opsDb().kotamaops.delete({ where: { id } });
  await discardLogo(existing.logo);
  await writeAudit({
    action: "kotamaops_delete",
    result: "ok",
    actorId: user.id,
    ip: requestIp(request),
    detail: `${existing.code} · ${existing.name}`,
  });
  return NextResponse.json({ id, situationId: existing.situation?.id ?? null });
}
