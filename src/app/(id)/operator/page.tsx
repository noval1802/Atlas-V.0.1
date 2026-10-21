import { redirect } from "next/navigation";
import { canManageUsers, canWriteSituation, portalLabel, situationWhere } from "@/lib/ops/access";
import { currentUser, publicUser } from "@/lib/ops/current-user";
import { opsDb } from "@/lib/ops/db";
import { OperatorDashboard } from "@/components/ops/operator-dashboard";

export const dynamic = "force-dynamic";

export default async function OperatorPage() {
  const user = await currentUser();
  if (!user) redirect("/masuk?next=/operator");
  const scope = situationWhere(user.role, user.kotamaopsId);
  const [rows, revisions] = await Promise.all([
    opsDb().situation.findMany({
      where: scope,
      include: { kotamaops: true },
      orderBy: { kotamaops: { code: "asc" } },
    }),
    opsDb().situationRevision.findMany({
      where: scope,
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        kotamaops: { select: { code: true, name: true } },
        editor: { select: { name: true } },
      },
    }),
  ]);
  const profile = publicUser(user);
  const initial = rows.map((row) => ({
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
  }));
  return (
    <OperatorDashboard
      me={{
        name: profile.name,
        username: profile.username,
        role: profile.role,
        portal: portalLabel(profile.role),
        unit: profile.kotamaops ? `${profile.kotamaops.code} · ${profile.kotamaops.name}` : null,
      }}
      boardUser={{
        name: profile.name,
        role: profile.role,
        kotamaops: profile.kotamaops ? { code: profile.kotamaops.code, name: profile.kotamaops.name } : null,
      }}
      canWrite={canWriteSituation(user.role)}
      canManage={canManageUsers(user.role)}
      initial={initial}
      revisions={revisions.map((row) => ({
        id: row.id,
        at: row.createdAt.toISOString(),
        code: row.kotamaops.code,
        name: row.kotamaops.name,
        status: row.status,
        incidentCount: row.incidentCount,
        editor: row.editor?.name || "Petugas tidak tercatat",
      }))}
    />
  );
}
