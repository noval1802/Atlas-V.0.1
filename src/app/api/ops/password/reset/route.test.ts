import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashResetToken } from "@/lib/ops/reset-token";
import { resetRateLimits } from "@/lib/ops/rate-limit";

const token = "abcdefghijklmnopqrstuvwxyz0123456789ABCD";
const state = vi.hoisted(() => ({
  row: null as null | {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    usedAt: Date | null;
    user: { id: string; username: string };
  },
  passwordHash: "old",
  version: 0,
}));

vi.mock("@/lib/ops/db", () => ({
  opsDb: () => {
    const db = {
      passwordReset: {
        findUnique: async ({ where }: { where: { tokenHash: string } }) =>
          state.row && state.row.tokenHash === where.tokenHash ? state.row : null,
        update: async ({ data }: { data: { usedAt: Date } }) => {
          if (state.row) state.row.usedAt = data.usedAt;
          return state.row;
        },
        deleteMany: async () => ({ count: 0 }),
      },
      user: {
        update: async ({ data }: { data: { passwordHash: string; sessionVersion: { increment: number } } }) => {
          state.passwordHash = data.passwordHash;
          state.version += data.sessionVersion.increment;
          return {};
        },
      },
      $transaction: async (run: (tx: unknown) => Promise<void>) => run(db),
    };
    return db;
  },
}));

vi.mock("@/lib/ops/audit", () => ({
  requestIp: () => "203.0.113.12",
  writeAudit: async () => {},
}));

vi.mock("@/lib/ops/password", () => ({
  hashPassword: async () => "scrypt$baru$hash",
}));

import { POST } from "./route";

function reset(body: Record<string, unknown>) {
  return POST(new Request("http://osiris.local/api/ops/password/reset", { method: "POST", body: JSON.stringify(body) }));
}

describe("POST /api/ops/password/reset", () => {
  beforeEach(() => {
    state.row = {
      id: "reset-1",
      userId: "user-1",
      tokenHash: hashResetToken(token),
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
      user: { id: "user-1", username: "budi.ops" },
    };
    state.passwordHash = "old";
    state.version = 0;
    resetRateLimits();
  });

  it("replaces the password once and rejects the same token afterwards", async () => {
    const first = await reset({ token, password: "kata-sandi-baru", confirmPassword: "kata-sandi-baru" });
    expect(first.status).toBe(200);
    expect(state.passwordHash).toBe("scrypt$baru$hash");
    expect(state.version).toBe(1);
    const second = await reset({ token, password: "kata-sandi-baru", confirmPassword: "kata-sandi-baru" });
    expect(second.status).toBe(400);
    expect(await second.json()).toMatchObject({ error: "Tautan reset sudah dipakai." });
    expect(state.version).toBe(1);
  });

  it("rejects an expired token and a confirmation that does not match", async () => {
    state.row = state.row && { ...state.row, expiresAt: new Date(Date.now() - 1000) };
    const expired = await reset({ token, password: "kata-sandi-baru", confirmPassword: "kata-sandi-baru" });
    expect(expired.status).toBe(400);
    expect(await expired.json()).toMatchObject({ error: "Tautan reset sudah kedaluwarsa." });
    expect(state.passwordHash).toBe("old");
    state.row = state.row && { ...state.row, expiresAt: new Date(Date.now() + 60_000) };
    const mismatch = await reset({ token, password: "kata-sandi-baru", confirmPassword: "bukan-sama" });
    expect(mismatch.status).toBe(400);
    expect(await mismatch.json()).toMatchObject({ error: "Konfirmasi kata sandi tidak sama." });
  });

  it("refuses a weak or username-based password and leaves the token usable", async () => {
    const short = await reset({ token, password: "Kabut-Pagi1", confirmPassword: "Kabut-Pagi1" });
    expect(short.status).toBe(400);
    const owner = await reset({ token, password: "Budi.Ops-Merapi-27", confirmPassword: "Budi.Ops-Merapi-27" });
    expect(owner.status).toBe(400);
    expect(await owner.json()).toMatchObject({ error: "Kata sandi tidak boleh memuat nama pengguna." });
    expect(state.passwordHash).toBe("old");
    expect(state.row?.usedAt).toBeNull();
    const ok = await reset({ token, password: "Merapi-Kabut-Pagi-27", confirmPassword: "Merapi-Kabut-Pagi-27" });
    expect(ok.status).toBe(200);
  });
});