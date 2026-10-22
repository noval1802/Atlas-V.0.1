import { redirect } from "next/navigation";
import { currentUser } from "@/lib/ops/current-user";
import { opsDb } from "@/lib/ops/db";
import Dashboard from "./monitoring-dashboard";

export const dynamic = "force-dynamic";

export default async function PetaPage() {
  const user = await currentUser();
  if (!user) redirect("/masuk?next=/peta");
  const rows = await opsDb().kotamaops.findMany({ orderBy: [{ matra: "asc" }, { code: "asc" }] });
  const kotamaops = rows.map((row) => ({
    code: row.code,
    name: row.name,
    region: row.region,
    location: row.location,
    lat: row.latitude,
    lng: row.longitude,
    matra: row.matra,
    logo: row.logo,
  }));
  return <Dashboard kotamaops={kotamaops} role={user.role} userName={user.name} />;
}
