import { NextResponse } from "next/server";
import { canAddKotamaops, parseNewKotamaops } from "@/lib/ops/access";
import { requestIp, writeAudit } from "@/lib/ops/audit";
import { currentUser } from "@/lib/ops/current-user";
import { opsDb } from "@/lib/ops/db";
import { presentSituation, presentUnit, readUnitForm } from "@/lib/ops/kotamaops-admin";
import { discardLogo, storeLogo } from "@/lib/ops/kotamaops-logo";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Masuk diperlukan." }, { status: 401 });
  if (!canAddKotamaops(user.role)) return NextResponse.json({ error: "Peran ini tidak mengelola Kotamaops." }, { status: 403 });
  const units = await opsDb().kotamaops.findMany({
    include: { situation: true, _count: { select: { users: true } } },
    orderBy: [{ matra: "asc" }, { code: "asc" }],
  });
  return NextResponse.json({ units: units.map(presentUnit) });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Masuk diperlukan." }, { status: 401 });
  if (!canAddKotamaops(user.role)) {
    return NextResponse.json({ error: "Peran ini tidak dapat menambah Kotamaops." }, { status: 403 });
  }
  const form = await readUnitForm(request);
  if (!form.ok) return NextResponse.json({ error: form.error }, { status: 400 });
  const parsed = parseNewKotamaops(form.fields);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const taken = await opsDb().kotamaops.findUnique({ where: { code: parsed.value.code } });
  if (taken) return NextResponse.json({ error: `Kode ${parsed.value.code} sudah dipakai.` }, { status: 409 });

  const logo = form.logo ? await storeLogo(parsed.value.code, form.logo.bytes, form.logo.kind) : "";
  try {
    // The unit and its first situation row go in together, so the dashboard never shows a unit without a row.
    const unit = await opsDb().$transaction(async (tx) => {
      const created = await tx.kotamaops.create({ data: { ...parsed.value, logo } });
      await tx.situation.create({
        data: {
          kotamaopsId: created.id,
          status: "KONDUSIF",
          personnel: 0,
          deployed: 0,
          incidentCount: 0,
          note: "Belum ada laporan.",
          updatedByName: user.name,
        },
      });
      return tx.kotamaops.findUniqueOrThrow({
        where: { id: created.id },
        include: { situation: true, _count: { select: { users: true } } },
      });
    });
    await writeAudit({
      action: "kotamaops_create",
      result: "ok",
      actorId: user.id, // targetId points at User, so the unit goes in detail
      ip: requestIp(request),
      detail: `${unit.code} · ${unit.name}`,
    });
    return NextResponse.json(
      { unit: presentUnit(unit), row: presentSituation({ ...unit.situation!, kotamaops: unit }) },
      { status: 201 },
    );
  } catch (error) {
    await discardLogo(logo);
    throw error;
  }
}
