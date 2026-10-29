/**
 * Aturan kata sandi akun ops, dipakai aplikasi (src/lib/ops/access.ts) dan seed.
 * Berkas ini di prisma/ karena image migrator Docker hanya menyalin folder ini.
 * Login tidak memanggilnya: akun lama tetap bisa masuk, aturan berlaku saat sandi dibuat atau diganti.
 */

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 200;

/** Nama sistem, peran, dan pola umum yang membuat sandi mudah ditebak. */
const GUESSABLE = ["atlas", "osiris", "pusdalops", "admin", "operator", "password", "katasandi", "qwerty", "123456"];

/**
 * @param {string} password
 * @param {string} [username] nama pengguna pemilik sandi, bila diketahui
 * @returns {string | null} pesan penolakan, atau null bila sandi diterima
 */
export function passwordProblem(password, username) {
  if (password.length < PASSWORD_MIN_LENGTH) return `Kata sandi minimal ${PASSWORD_MIN_LENGTH} karakter.`;
  if (password.length > PASSWORD_MAX_LENGTH) return "Kata sandi terlalu panjang.";
  const lower = password.toLowerCase();
  if (/^(.)\1+$/.test(lower)) return "Kata sandi tidak boleh berupa satu karakter yang diulang.";
  const name = (username ?? "").trim().toLowerCase();
  if (name.length >= 3 && lower.includes(name)) return "Kata sandi tidak boleh memuat nama pengguna.";
  if (GUESSABLE.some((word) => lower.includes(word))) {
    return "Kata sandi tidak boleh memuat kata yang mudah ditebak, seperti nama aplikasi atau peran.";
  }
  return null;
}
