import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { homeForRole } from "@/lib/ops/access";
import { sessionAccount } from "@/lib/ops/gate";
import { OPS_COOKIE } from "@/lib/ops/session";

export const dynamic = "force-dynamic";

/** The address visitors open. A live session continues to that role's home. Everyone else sees login. */
export default async function Home() {
  const token = (await cookies()).get(OPS_COOKIE)?.value;
  const account = await sessionAccount(token);
  if (account) redirect(homeForRole(account.role));
  redirect("/masuk");
}
