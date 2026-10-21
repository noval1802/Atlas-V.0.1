import { NextResponse } from "next/server";
import { canManageUsers } from "@/lib/ops/access";
import { currentUser } from "@/lib/ops/current-user";
import { opsDb } from "@/lib/ops/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await currentUser();
  if (!actor) return NextResponse.json({ error: "Masuk diperlukan." }, { status: 401 });
  if (!canManageUsers(actor.role)) return NextResponse.json({ error: "Peran ini tidak membaca jejak autentikasi." }, { status: 403 });
  const rows = await opsDb().authAudit.findMany({
    orderBy: { createdAt: "desc" },
    take: 80,
    include: {
      actor: { select: { username: true } },
      target: { select: { username: true } },
    },
  });
  return NextResponse.json({
    audits: rows.map((row) => ({
      id: row.id,
      action: row.action,
      result: row.result,
      actor: row.actor?.username ?? null,
      target: row.target?.username ?? null,
      ip: row.ip,
      detail: row.detail,
      createdAt: row.createdAt.toISOString(),
    })),
  });
}
