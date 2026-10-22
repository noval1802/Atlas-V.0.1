import { PrismaClient } from "@prisma/client";
import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const db = new PrismaClient();

// [kode, nama, wilayah, lokasi, lintang, bujur, status awal, personel, dikerahkan, kejadian, matra]
const units = [
  ["I/BB", "Kodam I/BB", "Sumatera Utara", "Medan", 3.59358, 98.622275, "KONDUSIF", 3850, 420, 7, "AD"],
  ["II/SWJ", "Kodam II/SWJ", "Sumatera Selatan", "Palembang", -2.970204, 104.749884, "WASPADA", 3600, 510, 8, "AD"],
  ["III/SLW", "Kodam III/SLW", "Jawa Barat", "Bandung", -6.909348, 107.613295, "SIAGA", 4300, 780, 16, "AD"],
  ["IM", "Kodam IM", "Aceh", "Banda Aceh", 5.555816, 95.320432, "KONDUSIF", 2800, 290, 4, "AD"],
  ["IV/DIP", "Kodam IV/DIP", "Jawa Tengah", "Semarang", -7.085942, 110.407235, "KONDUSIF", 4100, 390, 6, "AD"],
  ["IX/UDY", "Kodam IX/UDY", "Bali dan Nusa Tenggara", "Denpasar", -8.656989, 115.216424, "KONDUSIF", 3100, 240, 3, "AD"],
  ["JAYA", "Kodam Jaya", "DKI Jakarta", "Jakarta", -6.2, 106.82, "WASPADA", 4120, 680, 18, "AD"],
  ["KODAERAL V", "Kodaeral V", "Surabaya", "Surabaya", -7.213222, 112.724934, "KONDUSIF", 0, 0, 0, "AL"],
  ["V/BRW", "Kodam V/BRW", "Jawa Timur", "Surabaya", -7.298221, 112.722126, "KONDUSIF", 4450, 520, 9, "AD"],
  ["VI/MLW", "Kodam VI/MLW", "Kalimantan Timur", "Balikpapan", -1.24, 116.85, "WASPADA", 2950, 610, 11, "AD"],
  ["XII/TPR", "Kodam XII/TPR", "Kalimantan Barat", "Kubu Raya", -0.02, 109.34, "WASPADA", 2700, 440, 7, "AD"],
  ["XIII/MDK", "Kodam XIII/MDK", "Sulawesi Utara", "Manado", 1.47, 124.84, "KONDUSIF", 2600, 210, 4, "AD"],
  ["XIV/HSN", "Kodam XIV/HSN", "Sulawesi Selatan", "Makassar", -5.15, 119.43, "WASPADA", 3350, 560, 10, "AD"],
  ["XIX/TT", "Kodam XIX/TT", "Riau", "Pekanbaru", 0.51, 101.45, "WASPADA", 2550, 370, 5, "AD"],
  ["XV/PTM", "Kodam XV/PTM", "Maluku", "Ambon", -3.7, 128.18, "KONDUSIF", 2450, 180, 3, "AD"],
  ["XVII/CEN", "Kodam XVII/CEN", "Papua", "Jayapura", -2.59, 140.67, "WASPADA", 3250, 630, 8, "AD"],
  ["XVIII/KSR", "Kodam XVIII/KSR", "Papua Barat", "Manokwari", -0.86, 134.06, "KONDUSIF", 2300, 190, 3, "AD"],
  ["XX/TIB", "Kodam XX/TIB", "Sumatera Barat", "Padang", -0.95, 100.35, "KONDUSIF", 2400, 230, 4, "AD"],
  ["XXI/RI", "Kodam XXI/RI", "Lampung", "Bandar Lampung", -5.43, 105.26, "KONDUSIF", 2500, 200, 3, "AD"],
  ["XXII/TB", "Kodam XXII/TB", "Kalimantan Tengah", "Palangkaraya", -2.21, 113.92, "WASPADA", 2380, 410, 6, "AD"],
  ["XXIII/PW", "Kodam XXIII/PW", "Sulawesi Tengah", "Sigi / Palu", -0.9, 119.87, "KONDUSIF", 2350, 220, 4, "AD"],
  ["XXIV/MT", "Kodam XXIV/MT", "Papua Selatan", "Merauke", -8.49, 140.4, "KONDUSIF", 2100, 160, 2, "AD"],
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

for (const [code, name, region, location, latitude, longitude, status, personnel, deployed, incidentCount, matra] of units) {
  const logo = logoFor(code);
  const kotamaops = await db.kotamaops.upsert({
    where: { code },
    update: { name, region, location, latitude, longitude, matra, logo },
    create: { code, name, region, location, latitude, longitude, matra, logo },
  });
  await db.situation.upsert({
    where: { kotamaopsId: kotamaops.id },
    update: {},
    create: {
      kotamaopsId: kotamaops.id,
      status,
      personnel,
      deployed,
      incidentCount,
      note: "Data awal dari ATLAS. Perbarui lewat dasbor operator.",
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
