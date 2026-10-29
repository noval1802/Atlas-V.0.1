import { passwordProblem } from "./password-policy.mjs";
import { hashPassword } from "./password-hash.mjs";

/**
 * Pemulihan sandi SUPER_ADMIN dari mesin yang punya akses sah ke basis data.
 *
 * Hanya mengganti sandi akun SUPER_ADMIN yang sudah ada: tidak membuat akun, tidak
 * mengubah peran atau status. sessionVersion dinaikkan sehingga semua sesi lama gugur.
 * Pesan yang dikembalikan tidak pernah memuat sandi.
 *
 * @param {import("@prisma/client").PrismaClient} db
 * @param {{ username: string, password: string, confirmPassword: string, hash?: (password: string) => Promise<string> }} input
 * @returns {Promise<{ ok: true, username: string, sessionVersion: number, warning: string | null } | { ok: false, error: string }>}
 */
export async function recoverAdminPassword(db, { username, password, confirmPassword, hash = hashPassword }) {
  const name = (username ?? "").trim().toLowerCase();
  if (!name) return { ok: false, error: "Nama pengguna wajib diisi." };
  if (password !== confirmPassword) return { ok: false, error: "Konfirmasi kata sandi tidak sama." };
  const problem = passwordProblem(password, name);
  if (problem) return { ok: false, error: problem };

  const user = await db.user.findUnique({ where: { username: name } });
  // Same answer for a missing account and a non-admin one: the tool does not confirm who exists.
  if (!user || user.role !== "SUPER_ADMIN") {
    return { ok: false, error: `Tidak ada akun SUPER_ADMIN bernama ${name}. Alat ini tidak membuat akun dan tidak mengubah peran.` };
  }

  const passwordHash = await hash(password);
  const saved = await db.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: user.id },
      data: { passwordHash, sessionVersion: { increment: 1 } },
    });
    await tx.authAudit.create({
      data: { action: "password_recovery_local", result: "ok", actorId: null, targetId: user.id, detail: "pemulihan lokal lewat basis data" },
    });
    return updated;
  });

  const warning = !saved.active || saved.accountStatus !== "ACTIVE"
    ? "Akun ini tidak aktif, jadi tetap tidak bisa masuk. Status akun tidak diubah oleh alat ini."
    : null;
  return { ok: true, username: name, sessionVersion: saved.sessionVersion, warning };
}
