import { NextResponse } from "next/server";
import { canWriteSituation, parseSituation, situationWriteLookup } from "@/lib/ops/access";
import { currentUser } from "@/lib/ops/current-user";
import { opsDb } from "@/lib/ops/db";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Masuk diperlukan." }, { status: 401 });
  if (!canWriteSituation(user.role)) return NextResponse.json({ error: "Peran ini hanya dapat membaca." }, { status: 403 });
  const { id } = await context.params;
  const existing = await opsDb().situation.findUnique({ where: { id }, include: { kotamaops: true } });
  if (situationWriteLookup(user.role, user.kotamaopsId, existing?.kotamaopsId ?? null) === "absent") {
    return NextResponse.json({ error: "Situasi tidak ditemukan." }, { status: 404 });
  }
  const parsed = parseSituation(await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const saved = await opsDb().$transaction(async (tx) => {
    const situation = await tx.situation.update({
      where: { id },
      data: { ...parsed.value, updatedByName: user.name },
      include: { kotamaops: true },
    });
    await tx.situationRevision.create({
      data: { kotamaopsId: situation.kotamaopsId, editorId: user.id, ...parsed.value },
    });
    return situation;
  });
  return NextResponse.json({
    id: saved.id,
    code: saved.kotamaops.code,
    name: saved.kotamaops.name,
    region: saved.kotamaops.region,
    location: saved.kotamaops.location,
    status: saved.status,
    personnel: saved.personnel,
    deployed: saved.deployed,
    incidentCount: saved.incidentCount,
    note: saved.note,
    updatedByName: saved.updatedByName,
    updatedAt: saved.updatedAt.toISOString(),
  });
}
