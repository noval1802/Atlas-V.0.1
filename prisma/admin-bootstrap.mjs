import { passwordProblem } from "./password-policy.mjs";

/**
 * Putuskan apa yang dilakukan seed terhadap akun SUPER_ADMIN.
 *
 * Seed hanya membuat admin pertama. Mengubah OPS_ADMIN_PASSWORD di .env tidak pernah
 * merotasi akun yang sudah ada; sandi akun lama diganti lewat menu Pengguna.
 * Selama ada SUPER_ADMIN aktif, seed juga tidak membuat SUPER_ADMIN tambahan,
 * jadi mengganti OPS_ADMIN_USERNAME tidak diam-diam menambah akun berhak penuh.
 *
 * @param {{ activeSuperAdmins: number, usernameTaken: boolean, username: string, password: string }} state
 * @returns {{ action: "create" } | { action: "skip", notice: string | null } | { action: "error", message: string }}
 */
export function planAdminBootstrap({ activeSuperAdmins, usernameTaken, username, password }) {
  if (activeSuperAdmins > 0) {
    return {
      action: "skip",
      notice: password
        ? "SUPER_ADMIN aktif sudah ada; OPS_ADMIN_PASSWORD diabaikan dan tidak merotasi akun mana pun. Ganti sandi lewat menu Pengguna, lalu kosongkan OPS_ADMIN_PASSWORD di .env."
        : null,
    };
  }
  if (!username || !password) {
    return { action: "error", message: "Belum ada SUPER_ADMIN aktif. Isi OPS_ADMIN_USERNAME dan OPS_ADMIN_PASSWORD untuk membuat admin pertama." };
  }
  const problem = passwordProblem(password, username);
  if (problem) return { action: "error", message: `OPS_ADMIN_PASSWORD ditolak: ${problem}` };
  if (usernameTaken) {
    return {
      action: "error",
      message: `Belum ada SUPER_ADMIN aktif, tetapi nama pengguna ${username} sudah dipakai akun lain. Seed tidak mengubah akun yang ada; pulihkan akun itu atau pakai OPS_ADMIN_USERNAME lain.`,
    };
  }
  return { action: "create" };
}
