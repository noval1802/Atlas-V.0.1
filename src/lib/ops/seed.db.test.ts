import { execFileSync, spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assertTestDatabase } from "./test-db-guard";

/*
 * Runs prisma/seed.mjs against a throwaway database. Opt-in:
 *   TEST_DATABASE_URL=postgresql://osiris@127.0.0.1:5433/osiris_ops_test npx vitest run src/lib/ops/seed.db.test.ts
 * The guard below refuses any other database, so the working osiris_ops can never be wiped by mistake.
 */
const url = process.env.TEST_DATABASE_URL;

const STRONG = "Merapi-Kabut-Pagi-27";

describe.skipIf(!url)("seed admin bootstrap against a real database", () => {
  let db: PrismaClient;

  // Every admin variable is passed explicitly, even empty, so Prisma's .env loading cannot fill in real values.
  function seed(username: string, password: string) {
    const result = spawnSync("node", ["prisma/seed.mjs"], {
      env: { NODE_ENV: "test", PATH: process.env.PATH, DATABASE_URL: url, OPS_ADMIN_USERNAME: username, OPS_ADMIN_PASSWORD: password },
      encoding: "utf8",
    });
    return { code: result.status, output: `${result.stdout}${result.stderr}` };
  }

  async function wipe() {
    await db.user.deleteMany();
    await db.situation.deleteMany();
    await db.kotamaops.deleteMany();
  }

  beforeAll(async () => {
    assertTestDatabase(url!);
    execFileSync("npx", ["prisma", "migrate", "deploy"], { env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" });
    db = new PrismaClient({ datasources: { db: { url } } });
    await wipe();
  }, 120_000);

  afterAll(async () => {
    await db?.$disconnect();
  });

  it("refuses an empty database without admin credentials and writes nothing", async () => {
    const run = seed("", "");
    expect(run.code).not.toBe(0);
    expect(run.output).toContain("Belum ada SUPER_ADMIN aktif");
    expect(await db.user.count()).toBe(0);
    expect(await db.kotamaops.count()).toBe(0);
  }, 60_000);

  it("refuses a weak bootstrap password and writes nothing", async () => {
    const run = seed("penjaga", "admin-atlas-1");
    expect(run.code).not.toBe(0);
    expect(run.output).toContain("OPS_ADMIN_PASSWORD ditolak");
    expect(run.output).not.toContain("admin-atlas-1");
    expect(await db.user.count()).toBe(0);
  }, 60_000);

  it("creates the first super admin, then never rotates or duplicates it", async () => {
    expect(seed("penjaga", STRONG).code).toBe(0);
    const admin = await db.user.findUniqueOrThrow({ where: { username: "penjaga" } });
    expect(admin.role).toBe("SUPER_ADMIN");

    const rotated = seed("penjaga", "Rinjani-Senja-Biru-41");
    expect(rotated.code).toBe(0);
    expect(rotated.output).toContain("tidak merotasi");
    expect(rotated.output).not.toContain("Rinjani-Senja-Biru-41");
    expect((await db.user.findUniqueOrThrow({ where: { username: "penjaga" } })).passwordHash).toBe(admin.passwordHash);

    expect(seed("penjaga.baru", "Rinjani-Senja-Biru-41").code).toBe(0);
    expect(await db.user.count({ where: { role: "SUPER_ADMIN" } })).toBe(1);

    expect(seed("", "").code).toBe(0);
    expect(await db.user.count()).toBe(1);
    expect(await db.kotamaops.count()).toBeGreaterThan(0);
  }, 120_000);
});
