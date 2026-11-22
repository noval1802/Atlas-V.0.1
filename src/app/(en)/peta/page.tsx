import { redirect } from "next/navigation";
import { situationWhere } from "@/lib/ops/access";
import { currentUser } from "@/lib/ops/current-user";
import { opsDb } from "@/lib/ops/db";
import { tileProxyPath } from "@/lib/tile-proxy";
import Dashboard from "./monitoring-dashboard";

export const dynamic = "force-dynamic";

export default async function PetaPage() {
  const user = await currentUser();
  if (!user) redirect("/masuk?next=/peta");
  const rows = await opsDb().kotamaops.findMany({ orderBy: [{ matra: "asc" }, { code: "asc" }] });
  // Same scope as /api/ops/situations: a Kodam operator sees only their own unit's situation.
  const situations = new Map(
    (await opsDb().situation.findMany({ where: situationWhere(user.role, user.kotamaopsId) })).map((s) => [s.kotamaopsId, s]),
  );
  const kotamaops = rows.map((row) => ({
    code: row.code,
    name: row.name,
    region: row.region,
    location: row.location,
    lat: row.latitude,
    lng: row.longitude,
    matra: row.matra,
    logo: row.logo,
    situation: situationOf(situations.get(row.id)),
  }));
  return <Dashboard kotamaops={kotamaops} role={user.role} userName={user.name} tileProxy={tileProxyPath(process.env.TILE_PROXY_PATH)} />;
}

function situationOf(s: { status: string; personnel: number; deployed: number; incidentCount: number; note: string; updatedByName: string; updatedAt: Date } | undefined) {
  if (!s) return undefined;
  const { status, personnel, deployed, incidentCount, note, updatedByName, updatedAt } = s;
  return { status, personnel, deployed, incidentCount, note, updatedByName, updatedAt: updatedAt.toISOString() };
}
