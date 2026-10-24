import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimits } from "@/lib/ops/rate-limit";

const state = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
  audits: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/ops/db", () => ({
  opsDb: () => ({
    user: {
      findFirst: async ({ where }: { where: { OR: Array<{ username?: string; email?: string }> } }) =>
        state.rows.find((row) => where.OR.some((c) => (c.username ? row.username === c.username : row.email === c.email))) ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: "user-new", ...data };
        state.rows.push(row);
        return row;
      },
    },
  }),
}));

vi.mock("@/lib/ops/audit", () => ({
  requestIp: () => "203.0.113.9",
  writeAudit: async (entry: Record<string, unknown>) => {
    state.audits.push(entry);
  },
}));

vi.mock("@/lib/ops/password", () => ({
  hashPassword: async () => "scrypt$salt$hash",
}));

import { POST } from "./route";

const body = {
  name: "Budi Santoso",
  username: "budi.ops",
  email: "budi@example.com",
  organization: "Kodam Jaya",
  position: "Letnan",
  password: "kata-sandi-kuat",
  confirmPassword: "kata-sandi-kuat",
  role: "SUPER_ADMIN",
};

describe("POST /api/ops/register", () => {
  beforeEach(() => {
    state.rows = [];
    state.audits = [];
    resetRateLimits();
  });

  it("creates a pending analyst and does not issue a session", async () => {
    const response = await POST(new Request("http://osiris.local/api/ops/register", { method: "POST", body: JSON.stringify(body) }));
    expect(response.status).toBe(201);
    expect(response.headers.get("set-cookie")).toBeNull();
    const payload = await response.json();
    expect(payload.role).toBeUndefined();
    expect(payload.message).toContain("menunggu");
    expect(state.rows[0]).toMatchObject({ role: "ANALYST", accountStatus: "PENDING", active: false, email: "budi@example.com" });
    expect(JSON.stringify(state.audits)).not.toContain("kata-sandi-kuat");
    expect(state.audits[0]).toMatchObject({ action: "register", result: "pending" });
  });

  it("answers a taken username or email exactly like a new account", async () => {
    const fresh = await POST(new Request("http://osiris.local/api/ops/register", {
      method: "POST",
      body: JSON.stringify({ ...body, username: "orang.baru", email: "baru@example.com" }),
    }));
    const expected = await fresh.json();
    state.rows = [{ id: "ada", username: "budi.ops", email: "lain@example.com" }];
    for (const attempt of [body, { ...body, username: "budi.baru", email: "lain@example.com" }]) {
      const response = await POST(new Request("http://osiris.local/api/ops/register", { method: "POST", body: JSON.stringify(attempt) }));
      expect(response.status).toBe(fresh.status);
      expect(await response.json()).toEqual(expected);
    }
    expect(state.rows).toHaveLength(1);
    expect(state.audits.slice(-2).map((a) => a.result)).toEqual(["duplicate", "duplicate"]);
  });
});
