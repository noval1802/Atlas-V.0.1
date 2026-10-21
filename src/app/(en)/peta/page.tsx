import { redirect } from "next/navigation";
import { currentUser } from "@/lib/ops/current-user";
import Dashboard from "./monitoring-dashboard";

export const dynamic = "force-dynamic";

export default async function PetaPage() {
  const user = await currentUser();
  if (!user) redirect("/masuk?next=/peta");
  return <Dashboard />;
}
