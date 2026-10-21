import { beforeEach, describe, expect, it, vi } from "vitest";
import { PUBLIC_RESET_MESSAGE } from "@/lib/ops/reset-token";
import { resetRateLimits } from "@/lib/ops/rate-limit";

const state = vi.hoisted(() => ({
  users: [] as Array<Record<string, unknown>>,
  created: 0,
}));

vi.mock("@/lib/ops/db", () => ({
  opsDb: () => ({
    user: {
      findUnique: async ({ where }: { where: { email?: string } }) => state.users.find((user) => user.email === where.email) ?? null,
    },
    passwordReset: {
      create: async () => {
        state.created += 1;
        return {};
      },
      deleteMany: async () => ({ count: 0 }),
    },
  }),
}));

vi.mock("@/lib/ops/audit", () => ({
  requestIp: () => "203.0.113.11",
  writeAudit: async () => {},
}));

import { POST } from "./route";

describe("POST /api/ops/password/forgot", () => {
  beforeEach(() => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_FROM;
    state.users = [{ id: "u1", email: "ada@example.com", accountStatus: "ACTIVE" }];
    state.created = 0;
    resetRateLimits();
  });

  it("returns the same public message for a known and an unknown email", async () => {
    const known = await POST(new Request("http://osiris.local/api/ops/password/forgot", {
      method: "POST",
      body: JSON.stringify({ email: "ada@example.com" }),
    }));
    const unknown = await POST(new Request("http://osiris.local/api/ops/password/forgot", {
      method: "POST",
      body: JSON.stringify({ email: "tidak@example.com" }),
    }));
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(await known.json()).toEqual({ ok: true, message: PUBLIC_RESET_MESSAGE });
    expect(await unknown.json()).toEqual({ ok: true, message: PUBLIC_RESET_MESSAGE });
    expect(state.created).toBe(0);
  });
});