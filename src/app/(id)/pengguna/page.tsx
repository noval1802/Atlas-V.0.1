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

function stamp(value: Date) {
  return value.toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" });
}

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
    <OpsShell title="Manajemen pengguna" subtitle="Persetujuan, peran, dan jejak autentikasi." role={user.role}>
      <UserBoard actorRole={user.role} kotamaops={kotamaops} initialUsers={initialUsers} />
      <section className="ops-rise mt-8 space-y-2">
        <h2 className="text-sm font-semibold">
          Jejak autentikasi <span className="text-white/50">({audits.length} terbaru)</span>
        </h2>
        {audits.length === 0 && <p className="text-sm text-white/60">Belum ada catatan.</p>}
        {audits.length > 0 && (
          <div className="max-h-[28rem] overflow-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[640px] text-left text-xs text-white/75">
              <thead className="sticky top-0 bg-[#0d0d12] text-[10px] uppercase tracking-wider text-white/50">
                <tr>
                  <th className="px-3 py-2 font-semibold">Waktu (WIB)</th>
                  <th className="px-3 py-2 font-semibold">Aksi</th>
                  <th className="px-3 py-2 font-semibold">Hasil</th>
                  <th className="px-3 py-2 font-semibold">Pelaku → target</th>
                  <th className="px-3 py-2 font-semibold">IP / detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {audits.map((row) => (
                  <tr key={row.id} className="align-top hover:bg-white/[0.06]">
                    <td className="whitespace-nowrap px-3 py-2 text-white/55">{stamp(row.createdAt)}</td>
                    <td className="px-3 py-2">{auditLabel[row.action] ?? row.action}</td>
                    <td className="px-3 py-2">{row.result}</td>
                    <td className="px-3 py-2">
                      {row.actor?.username ?? "—"}
                      {row.target ? ` → ${row.target.username}` : ""}
                    </td>
                    <td className="px-3 py-2 text-white/55">
                      {[row.ip, row.detail].filter(Boolean).join(" · ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </OpsShell>
  );
}
