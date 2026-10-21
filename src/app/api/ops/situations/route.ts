import { NextResponse } from "next/server";
import { situationWhere } from "@/lib/ops/access";
import { currentUser } from "@/lib/ops/current-user";
import { opsDb } from "@/lib/ops/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Masuk diperlukan." }, { status: 401 });
  const rows = await opsDb().situation.findMany({
    where: situationWhere(user.role, user.kotamaopsId),
    include: { kotamaops: true },
    orderBy: { kotamaops: { code: "asc" } },
  });
  return NextResponse.json({
    situations: rows.map((row) => ({
      id: row.id,
      code: row.kotamaops.code,
      name: row.kotamaops.name,
      region: row.kotamaops.region,
      location: row.kotamaops.location,
      status: row.status,
      personnel: row.personnel,
      deployed: row.deployed,
      incidentCount: row.incidentCount,
      note: row.note,
      updatedByName: row.updatedByName,
      updatedAt: row.updatedAt.toISOString(),
    })),
  });
}
