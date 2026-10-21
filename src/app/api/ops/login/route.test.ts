import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimits } from "@/lib/ops/rate-limit";

const state = vi.hoisted(() => ({
  users: [] as Array<Record<string, unknown>>,
  audits: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/ops/db", () => ({
  opsDb: () => ({
    user: {
      findUnique: async ({ where }: { where: { username?: string } }) =>
        state.users.find((user) => user.username === where.username) ?? null,
      update: async () => ({}),
    },
  }),
}));

vi.mock("@/lib/ops/audit", () => ({
  requestIp: () => "203.0.113.10",
  writeAudit: async (entry: Record<string, unknown>) => {
    state.audits.push(entry);
  },
}));

vi.mock("@/lib/ops/password", () => ({
  DUMMY_PASSWORD_HASH: "scrypt$dummy$hash",
  verifyPassword: async (password: string, stored: string) => stored !== "scrypt$dummy$hash" && password === "kata-sandi-benar",
}));

import { POST } from "./route";

function login(body: Record<string, unknown>) {
  return POST(new Request("http://osiris.local/api/ops/login", { method: "POST", body: JSON.stringify(body) }));
}

describe("POST /api/ops/login", () => {
  beforeEach(() => {
    process.env.OPS_SESSION_SECRET = "rahasia-uji-sesi";
    state.users = [];
    state.audits = [];
    resetRateLimits();
  });

  it("sets an httpOnly cookie and a role home for the right password", async () => {
    state.users.push({ id: "admin-1", username: "admin", passwordHash: "scrypt$asli$hash", role: "ADMIN", active: true, accountStatus: "ACTIVE", sessionVersion: 2 });
    const response = await login({ username: "Admin", password: "kata-sandi-benar", remember: true });
    expect(response.status).toBe(200);
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Max-Age=1209600");
    expect(cookie).not.toContain("kata-sandi");
    const payload = await response.json();
    expect(payload).toMatchObject({ ok: true, role: "ADMIN", home: "/pengguna" });
    expect(JSON.stringify(state.audits)).not.toContain("kata-sandi-benar");
  });

  it("uses the same public error for an unknown user and a wrong password", async () => {
    state.users.push({ id: "op-1", username: "operator", passwordHash: "scrypt$asli$hash", role: "OPERATOR_PUSDALOPS", active: true, accountStatus: "ACTIVE", sessionVersion: 0 });
    const unknown = await login({ username: "tidak-ada", password: "kata-sandi-benar" });
    const wrong = await login({ username: "operator", password: "salah-sekali" });
    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(await unknown.json()).toEqual(await wrong.json());
    expect(unknown.headers.get("set-cookie")).toBeNull();
  });

  it("sends each portal role to its own home", async () => {
    state.users.push({ id: "op-2", username: "operator.pusat", passwordHash: "scrypt$asli$hash", role: "OPERATOR_PUSDALOPS", active: true, accountStatus: "ACTIVE", sessionVersion: 0 });
    state.users.push({ id: "view-1", username: "peninjau", passwordHash: "scrypt$asli$hash", role: "ANALYST", active: true, accountStatus: "ACTIVE", sessionVersion: 0 });
    state.users.push({ id: "mon-1", username: "pantau", passwordHash: "scrypt$asli$hash", role: "PIMPINAN", active: true, accountStatus: "ACTIVE", sessionVersion: 0 });
    const operator = await login({ username: "operator.pusat", password: "kata-sandi-benar" });
    const viewer = await login({ username: "peninjau", password: "kata-sandi-benar" });
    const monitoring = await login({ username: "pantau", password: "kata-sandi-benar" });
    expect((await operator.json()).home).toBe("/operator");
    expect((await viewer.json()).home).toBe("/peta");
    expect((await monitoring.json()).home).toBe("/peta");
    state.users.push({ id: "root-1", username: "penjaga", passwordHash: "scrypt$asli$hash", role: "SUPER_ADMIN", active: true, accountStatus: "ACTIVE", sessionVersion: 0 });
    state.users.push({ id: "kodam-1", username: "operator.kodam", passwordHash: "scrypt$asli$hash", role: "OPERATOR_KODAM", active: true, accountStatus: "ACTIVE", sessionVersion: 0 });
    const root = await login({ username: "penjaga", password: "kata-sandi-benar" });
    const kodam = await login({ username: "operator.kodam", password: "kata-sandi-benar" });
    expect((await root.json()).home).toBe("/pengguna");
    expect((await kodam.json()).home).toBe("/operator");
  });

  it("does not sign in a disabled account", async () => {
    state.users.push({ id: "off-1", username: "nonaktif", passwordHash: "scrypt$asli$hash", role: "ANALYST", active: false, accountStatus: "DISABLED", sessionVersion: 0 });
    const response = await login({ username: "nonaktif", password: "kata-sandi-benar" });
    expect(response.status).toBe(403);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("does not sign in a pending account", async () => {
    state.users.push({ id: "new-1", username: "budi.ops", passwordHash: "scrypt$asli$hash", role: "ANALYST", active: false, accountStatus: "PENDING", sessionVersion: 0 });
    const response = await login({ username: "budi.ops", password: "kata-sandi-benar" });
    expect(response.status).toBe(403);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("rate limits repeated failures", async () => {
    let status = 0;
    for (let attempt = 0; attempt < 9; attempt += 1) {
      const response = await login({ username: "operator", password: "salah-sekali" });
      status = response.status;
    }
    expect(status).toBe(429);
  });
});