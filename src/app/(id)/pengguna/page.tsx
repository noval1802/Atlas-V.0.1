import { redirect } from "next/navigation";
import { canManageUsers, homeForRole } from "@/lib/ops/access";
import { currentUser } from "@/lib/ops/current-user";
import { opsDb } from "@/lib/ops/db";
import { OpsShell } from "@/components/ops/ops-shell";
import { UserBoard, type UserRow } from "./user-board";

export const dynamic = "force-dynamic";

const auditLabel: Record<string, string> = {
  login_success: "Masuk berhasil",
  login_failure: "Masuk gagal",
  logout: "Keluar",
  register: "Registrasi",
  password_reset_request: "Permintaan reset",
  password_reset_complete: "Reset selesai",
  account_approve: "Persetujuan akun",
  account_reject: "Penolakan akun",
  account_enable: "Pengaktifan akun",
  account_disable: "Penonaktifan akun",
  account_status: "Status akun",
  role_change: "Perubahan peran",
  account_create: "Pembuatan akun",
  password_change: "Perubahan kata sandi",
};

export default async function UsersPage() {
  const user = await currentUser();
  if (!user) redirect("/masuk?next=/pengguna");
  if (!canManageUsers(user.role)) redirect(homeForRole(user.role));
  const [users, kotamaops, audits] = await Promise.all([
    opsDb().user.findMany({ include: { kotamaops: true }, orderBy: { username: "asc" } }),
    opsDb().kotamaops.findMany({ orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }),
    opsDb().authAudit.findMany({
      orderBy: { createdAt: "desc" },
      take: 80,
      include: { actor: { select: { username: true } }, target: { select: { username: true } } },
    }),
  ]);
  const initialUsers: UserRow[] = users.map((item) => ({
    id: item.id,
    name: item.name,
    username: item.username,
    email: item.email,
    organization: item.organization,
    position: item.position,
    role: item.role,
    active: item.active,
    accountStatus: item.accountStatus,
    kotamaopsId: item.kotamaopsId,
    kotamaops: item.kotamaops ? { id: item.kotamaops.id, code: item.kotamaops.code, name: item.kotamaops.name } : null,
    lastLoginAt: item.lastLoginAt?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
  }));
  return (
    <OpsShell title="Manajemen pengguna" subtitle="Persetujuan, peran, dan jejak autentikasi." role={user.role} user={{ name: user.name, role: user.role }}>
      <UserBoard
        actorRole={user.role}
        kotamaops={kotamaops}
        initialUsers={initialUsers}
        audits={audits.map((row) => ({
          id: row.id,
          at: row.createdAt.toISOString(),
          action: row.action,
          label: auditLabel[row.action] ?? row.action,
          result: row.result,
          actor: row.actor?.username ?? null,
          target: row.target?.username ?? null,
          ip: row.ip,
          detail: row.detail,
        }))}
      />
    </OpsShell>
  );
}
