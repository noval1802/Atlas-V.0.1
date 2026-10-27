import { PrismaClient } from "@prisma/client";
import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const db = new PrismaClient();

// [kode, nama, wilayah, lokasi, lintang, bujur, matra]
// Tanpa status atau angka personel: seed hanya membuat baris kosong "belum dilaporkan".
// Angka contoh lama sempat terbaca sebagai data riil.
const units = [
  ["I/BB", "Kodam I/BB", "Sumatera Utara", "Medan", 3.59358, 98.622275, "AD"],
  ["II/SWJ", "Kodam II/SWJ", "Sumatera Selatan", "Palembang", -2.970204, 104.749884, "AD"],
  ["III/SLW", "Kodam III/SLW", "Jawa Barat", "Bandung", -6.909348, 107.613295, "AD"],
  ["IM", "Kodam IM", "Aceh", "Banda Aceh", 5.555816, 95.320432, "AD"],
  ["IV/DIP", "Kodam IV/DIP", "Jawa Tengah", "Semarang", -7.085942, 110.407235, "AD"],
  ["IX/UDY", "Kodam IX/UDY", "Bali dan Nusa Tenggara", "Denpasar", -8.656989, 115.216424, "AD"],
  ["JAYA", "Kodam Jaya", "DKI Jakarta", "Jakarta", -6.2, 106.82, "AD"],
  ["KODAERAL V", "Kodaeral V", "Surabaya", "Surabaya", -7.213222, 112.724934, "AL"],
  ["V/BRW", "Kodam V/BRW", "Jawa Timur", "Surabaya", -7.298221, 112.722126, "AD"],
  ["VI/MLW", "Kodam VI/MLW", "Kalimantan Timur", "Balikpapan", -1.24, 116.85, "AD"],
  ["XII/TPR", "Kodam XII/TPR", "Kalimantan Barat", "Kubu Raya", -0.02, 109.34, "AD"],
  ["XIII/MDK", "Kodam XIII/MDK", "Sulawesi Utara", "Manado", 1.47, 124.84, "AD"],
  ["XIV/HSN", "Kodam XIV/HSN", "Sulawesi Selatan", "Makassar", -5.15, 119.43, "AD"],
  ["XIX/TT", "Kodam XIX/TT", "Riau", "Pekanbaru", 0.51, 101.45, "AD"],
  ["XV/PTM", "Kodam XV/PTM", "Maluku", "Ambon", -3.7, 128.18, "AD"],
  ["XVII/CEN", "Kodam XVII/CEN", "Papua", "Jayapura", -2.59, 140.67, "AD"],
  ["XVIII/KSR", "Kodam XVIII/KSR", "Papua Barat", "Manokwari", -0.86, 134.06, "AD"],
  ["XX/TIB", "Kodam XX/TIB", "Sumatera Barat", "Padang", -0.95, 100.35, "AD"],
  ["XXI/RI", "Kodam XXI/RI", "Lampung", "Bandar Lampung", -5.43, 105.26, "AD"],
  ["XXII/TB", "Kodam XXII/TB", "Kalimantan Tengah", "Palangkaraya", -2.21, 113.92, "AD"],
  ["XXIII/PW", "Kodam XXIII/PW", "Sulawesi Tengah", "Sigi / Palu", -0.9, 119.87, "AD"],
  ["XXIV/MT", "Kodam XXIV/MT", "Papua Selatan", "Merauke", -8.49, 140.4, "AD"],
];

async function hashPassword(password) {
  const salt = randomBytes(16).toString("base64url");
  const hash = await scryptAsync(password, salt, 32);
  return `scrypt$${salt}$${hash.toString("base64url")}`;
}

const username = process.env.OPS_ADMIN_USERNAME?.trim().toLowerCase();
const password = process.env.OPS_ADMIN_PASSWORD;
if (!username || !password || password.length < 10) {
  throw new Error("OPS_ADMIN_USERNAME dan OPS_ADMIN_PASSWORD (minimal 10 karakter) wajib diisi sebelum seed.");
}

/** Lambang mengikuti nama file /public/kodam/<kode>.png, sama dengan migrasi matra. */
function logoFor(code) {
  return `/kodam/${code.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.png`;
}

for (const [code, name, region, location, latitude, longitude, matra] of units) {
  const logo = logoFor(code);
  const kotamaops = await db.kotamaops.upsert({
    where: { code },
    update: { name, region, location, latitude, longitude, matra, logo },
    create: { code, name, region, location, latitude, longitude, matra, logo },
  });
  await db.situation.upsert({
    where: { kotamaopsId: kotamaops.id },
    update: {},
    // Hanya baris baru. Situasi yang sudah dilaporkan operator tidak pernah ditimpa (update kosong).
    create: {
      kotamaopsId: kotamaops.id,
      status: "KONDUSIF",
      personnel: 0,
      deployed: 0,
      incidentCount: 0,
      note: "Belum ada laporan. Baris awal dari seed, bukan kondisi riil.",
      updatedByName: "seed",
    },
  });
}

const existing = await db.user.findUnique({ where: { username } });
if (!existing) {
  await db.user.create({
    data: {
      name: "Admin Pusdalops",
      username,
      passwordHash: await hashPassword(password),
      role: "SUPER_ADMIN",
    },
  });
}

console.log(`Kotamaops ${units.length}. Admin ${username} siap.`);
await db.$disconnect();
