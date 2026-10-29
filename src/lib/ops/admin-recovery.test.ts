import { describe, expect, it } from "vitest";
import { recoverAdminPassword } from "../../../prisma/admin-recovery.mjs";
import { hashPassword } from "../../../prisma/password-hash.mjs";
import { verifyPassword } from "./password";
import { assertTestDatabase } from "./test-db-guard";

type Row = { id: string; username: string; role: string; active: boolean; accountStatus: string; passwordHash: string; sessionVersion: number };

function fakeDb(rows: Row[]) {
  const audits: Array<Record<string, unknown>> = [];
  const db = {
    user: {
      findUnique: async ({ where }: { where: { username: string } }) => rows.find((row) => row.username === where.username) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: { passwordHash: string; sessionVersion: { increment: number } } }) => {
        const row = rows.find((item) => item.id === where.id)!;
        row.passwordHash = data.passwordHash;
        row.sessionVersion += data.sessionVersion.increment;
        return { ...row };
      },
    },
    authAudit: { create: async ({ data }: { data: Record<string, unknown> }) => audits.push(data) },
    $transaction: async <T>(run: (tx: unknown) => Promise<T>) => run(db),
  };
  return { db, audits };
}

const STRONG = "Merapi-Kabut-Pagi-27";

function rows(): Row[] {
  return [
    { id: "root", username: "penjaga", role: "SUPER_ADMIN", active: true, accountStatus: "ACTIVE", passwordHash: "scrypt$lama$hash", sessionVersion: 3 },
    { id: "ops", username: "operator.pusat", role: "OPERATOR_PUSDALOPS", active: true, accountStatus: "ACTIVE", passwordHash: "scrypt$ops$hash", sessionVersion: 0 },
  ];
}

describe("local super admin recovery", () => {
  it("replaces the hash with one the app accepts, revokes old sessions and audits without the password", async () => {
    const users = rows();
    const { db, audits } = fakeDb(users);
    const result = await recoverAdminPassword(db as never, { username: " Penjaga ", password: STRONG, confirmPassword: STRONG });
    expect(result).toEqual({ ok: true, username: "penjaga", sessionVersion: 4, warning: null });
    expect(await verifyPassword(STRONG, users[0].passwordHash)).toBe(true);
    expect(audits).toEqual([expect.objectContaining({ action: "password_recovery_local", result: "ok", targetId: "root" })]);
    expect(JSON.stringify({ result, audits })).not.toContain(STRONG);
  });

  it("refuses a mismatched confirmation, a weak password and a non-admin or unknown account, without writing", async () => {
    const users = rows();
    const { db, audits } = fakeDb(users);
    const cases = [
      { username: "penjaga", password: STRONG, confirmPassword: "Merapi-Kabut-Pagi-28" },
      { username: "penjaga", password: "Kabut-Pagi1", confirmPassword: "Kabut-Pagi1" },
      { username: "penjaga", password: "penjaga-merapi-27", confirmPassword: "penjaga-merapi-27" },
      { username: "operator.pusat", password: STRONG, confirmPassword: STRONG },
      { username: "tidak.ada", password: STRONG, confirmPassword: STRONG },
      { username: "", password: STRONG, confirmPassword: STRONG },
    ];
    for (const input of cases) {
      const result = await recoverAdminPassword(db as never, input);
      expect(result.ok).toBe(false);
      expect(JSON.stringify(result)).not.toContain(input.password);
    }
    expect(users.map((row) => [row.passwordHash, row.sessionVersion])).toEqual([["scrypt$lama$hash", 3], ["scrypt$ops$hash", 0]]);
    expect(audits).toEqual([]);
  });

  it("answers a missing account and a non-admin account identically", async () => {
    const { db } = fakeDb(rows());
    const missing = await recoverAdminPassword(db as never, { username: "tidak.ada", password: STRONG, confirmPassword: STRONG });
    const operator = await recoverAdminPassword(db as never, { username: "operator.pusat", password: STRONG, confirmPassword: STRONG });
    expect(String(!missing.ok && missing.error).replace("tidak.ada", "X")).toBe(String(!operator.ok && operator.error).replace("operator.pusat", "X"));
  });

  it("warns when the recovered account is inactive and leaves its status alone", async () => {
    const users = rows();
    users[0] = { ...users[0], active: false, accountStatus: "DISABLED" };
    const { db } = fakeDb(users);
    const result = await recoverAdminPassword(db as never, { username: "penjaga", password: STRONG, confirmPassword: STRONG });
    expect(result).toMatchObject({ ok: true, warning: expect.stringContaining("tidak aktif") });
    expect(users[0]).toMatchObject({ active: false, accountStatus: "DISABLED" });
  });

  it("hashes in the format the app verifies", async () => {
    expect(await verifyPassword(STRONG, await hashPassword(STRONG))).toBe(true);
    expect(await verifyPassword("Merapi-Kabut-Pagi-28", await hashPassword(STRONG))).toBe(false);
  });
});

describe("test database guard", () => {
  it("accepts only osiris_ops_test on localhost", () => {
    expect(() => assertTestDatabase("postgresql://osiris@127.0.0.1:5433/osiris_ops_test")).not.toThrow();
    expect(() => assertTestDatabase("postgresql://osiris@localhost:5433/osiris_ops_test")).not.toThrow();
    for (const url of [
      "postgresql://osiris@127.0.0.1:5433/osiris_ops",
      "postgresql://osiris@10.0.0.5:5433/osiris_ops_test",
      "postgresql://osiris@127.0.0.1:5433/osiris_ops_test_copy",
    ]) {
      expect(() => assertTestDatabase(url)).toThrow();
    }
  });
});
