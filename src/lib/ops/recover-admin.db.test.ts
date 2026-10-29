import { execFileSync, spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { verifyPassword } from "./password";
import { assertTestDatabase } from "./test-db-guard";

/*
 * Runs the recovery CLI as a real process against the throwaway database. Opt-in:
 *   TEST_DATABASE_URL=postgresql://osiris@127.0.0.1:5433/osiris_ops_test npm run test:db
 */
const url = process.env.TEST_DATABASE_URL;
const OLD_HASH = "scrypt$AAAAAAAAAAAAAAAAAAAAAA$AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE";
const STRONG = "Merapi-Kabut-Pagi-27";

describe.skipIf(!url)("recover-admin CLI against a real database", () => {
  let db: PrismaClient;

  // Input is piped, never passed as an argument; env is explicit so Prisma cannot pick up the working .env.
  function recover(args: string[], input: string) {
    const run = spawnSync("node", ["prisma/recover-admin.mjs", ...args], {
      env: { NODE_ENV: "test", PATH: process.env.PATH, DATABASE_URL: url },
      input,
      encoding: "utf8",
    });
    return { code: run.status, output: `${run.stdout}${run.stderr}` };
  }

  const admin = () => db.user.findUniqueOrThrow({ where: { username: "penjaga" } });

  beforeAll(async () => {
    assertTestDatabase(url!);
    execFileSync("npx", ["prisma", "migrate", "deploy"], { env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" });
    db = new PrismaClient({ datasources: { db: { url } } });
  }, 120_000);

  beforeEach(async () => {
    await db.authAudit.deleteMany();
    await db.user.deleteMany();
    await db.user.createMany({
      data: [
        { name: "Penjaga", username: "penjaga", passwordHash: OLD_HASH, role: "SUPER_ADMIN" },
        { name: "Operator", username: "operator.pusat", passwordHash: OLD_HASH, role: "OPERATOR_PUSDALOPS" },
      ],
    });
  });

  afterAll(async () => {
    await db?.$disconnect();
  });

  it("sets a new password the app accepts, revokes sessions and audits, printing no secret", async () => {
    const run = recover(["--username", "penjaga"], `${STRONG}\n${STRONG}\n`);
    expect(run.code).toBe(0);
    expect(run.output).toContain("sesi lama dicabut");
    expect(run.output).not.toContain(STRONG);
    const row = await admin();
    expect(row.sessionVersion).toBe(1);
    expect(await verifyPassword(STRONG, row.passwordHash)).toBe(true);
    expect(row.role).toBe("SUPER_ADMIN");
    expect(await db.authAudit.count({ where: { action: "password_recovery_local", targetId: row.id } })).toBe(1);
    expect(await db.user.count()).toBe(2);
  }, 60_000);

  it("refuses a password given as an argument and changes nothing", async () => {
    for (const args of [["--username", "penjaga", STRONG], ["--username", "penjaga", "--password", STRONG], ["--password", STRONG]]) {
      const run = recover(args, "");
      expect(run.code).toBe(2);
      expect(run.output).toContain("tidak diterima lewat argumen");
      expect(run.output).not.toContain(STRONG);
    }
    expect(await admin()).toMatchObject({ passwordHash: OLD_HASH, sessionVersion: 0 });
  }, 60_000);

  it("refuses a mismatched confirmation, a weak password and a non-admin target", async () => {
    const cases: Array<[string, string]> = [
      ["penjaga", `${STRONG}\nMerapi-Kabut-Pagi-28\n`],
      ["penjaga", "Kabut-Pagi1\nKabut-Pagi1\n"],
      ["operator.pusat", `${STRONG}\n${STRONG}\n`],
    ];
    for (const [username, input] of cases) {
      const run = recover(["--username", username], input);
      expect(run.code).toBe(1);
      expect(run.output).not.toContain(STRONG);
    }
    expect(await admin()).toMatchObject({ passwordHash: OLD_HASH, sessionVersion: 0 });
    expect((await db.user.findUniqueOrThrow({ where: { username: "operator.pusat" } })).passwordHash).toBe(OLD_HASH);
    expect(await db.authAudit.count()).toBe(0);
  }, 60_000);
});
