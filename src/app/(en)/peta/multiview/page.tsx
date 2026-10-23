import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/ops/current-user";
import MultiView from "./multiview";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Multiviewer CCTV · ATLAS" };

export default async function MultiViewPage() {
  const user = await currentUser();
  if (!user) redirect("/masuk?next=/peta");
  return <MultiView />;
}
