import { beforeEach, describe, expect, it, vi } from "vitest";

type FixtureUser = {
  id: string;
  name: string;
  username: string;
  email: string | null;
  organization: string;
  position: string;
  role: string;
  active: boolean;
  accountStatus: string;
  kotamaopsId: string | null;
  kotamaops: { id: string; code: string; name: string } | null;
  passwordHash: string;
  sessionVersion: number;
  lastLoginAt: Date | null;
  createdAt: Date;
};

const state = vi.hoisted(() => ({
  actor: null as FixtureUser | null,
  users: [] as FixtureUser[],
  units: [] as Array<{ id: string; code: string; name: string }>,
  audits: [] as Array<Record<string, unknown>>,
  writes: 0,
}));

function account(partial: Partial<FixtureUser> & Pick<FixtureUser, "id" | "username" | "role">): FixtureUser {
  return {
    name: partial.username,
    email: null,
    organization: "",
    position: "",
    active: true,
    accountStatus: "ACTIVE",
    kotamaopsId: null,
    kotamaops: null,
    passwordHash: "scrypt$tersimpan",
    sessionVersion: 0,
    lastLoginAt: null,
    createdAt: new Date("2026-10-13T00:00:00.000Z"),
    ...partial,
    id: partial.id,
    username: partial.username,
  };
}

vi.mock("@/lib/ops/db", () => ({
  opsDb: () => ({
    user: {
      findMany: async () => state.users.map((user) => ({ ...user })),
      findUnique: async ({ where }: { where: { id?: string; username?: string } }) => {
        const user = state.users.find((item) => (where.id ? item.id === where.id : item.username === where.username));
        return user ? { ...user } : null;
      },
      count: async ({ where }: { where: { role: string; active: boolean; accountStatus: string; id: { not: string } } }) =>
        state.users.filter((user) => (
          user.role === where.role
          && user.active === where.active
          && user.accountStatus === where.accountStatus
          && user.id !== where.id.not
        )).length,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const created = account({
          id: `made-${state.users.length + 1}`,
          username: String(data.username),
          role: String(data.role),
          name: String(data.name),
          kotamaopsId: (data.kotamaopsId as string | null) ?? null,
          active: data.active !== false,
          accountStatus: String(data.accountStatus),
          passwordHash: String(data.passwordHash),
        });
        state.users.push(created);
        state.writes += 1;
        return created;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const user = state.users.find((item) => item.id === where.id);
        if (!user) throw new Error("missing user");
        state.writes += 1;
        if (typeof data.name === "string") user.name = data.name;
        if (typeof data.role === "string") user.role = data.role;
        if (typeof data.active === "boolean") user.active = data.active;
        if (typeof data.accountStatus === "string") user.accountStatus = data.accountStatus;
        if ("kotamaopsId" in data) user.kotamaopsId = (data.kotamaopsId as string | null) ?? null;
        if (typeof data.passwordHash === "string") user.passwordHash = data.passwordHash;
        if (data.sessionVersion && typeof data.sessionVersion === "object") user.sessionVersion += 1;
        return user;
      },
    },
    kotamaops: {
      findMany: async () => state.units,
      findUnique: async ({ where }: { where: { id: string } }) => state.units.find((unit) => unit.id === where.id) ?? null,
    },
  }),
}));

vi.mock("@/lib/ops/current-user", () => ({
  currentUser: async () => state.actor,
  presentUser: (user: FixtureUser) => ({
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    active: user.active,
    accountStatus: user.accountStatus,
  }),
}));

vi.mock("@/lib/ops/audit", () => ({
  requestIp: () => "203.0.113.10",
  writeAudit: async (entry: Record<string, unknown>) => {
    state.audits.push(entry);
  },
}));

vi.mock("@/lib/ops/password", () => ({
  hashPassword: async () => "scrypt$redacted",
}));

import { GET, POST } from "./route";
import { PATCH } from "./[id]/route";

const PASSWORD = "Sandi-Uji-10";

function patch(id: string, body: Record<string, unknown>) {
  return PATCH(new Request("http://osiris.local/api/ops/users/" + id, {
    method: "PATCH",
    body: JSON.stringify(body),
  }), { params: Promise.resolve({ id }) });
}

function create(body: Record<string, unknown>) {
  return POST(new Request("http://osiris.local/api/ops/users", {
    method: "POST",
    body: JSON.stringify(body),
  }));
}

describe("user administration routes", () => {
  beforeEach(() => {
    state.actor = null;
    state.audits = [];
    state.writes = 0;
    state.units = [{ id: "unit-xii", code: "XII/TPR", name: "Tanjungpura" }];
    state.users = [
      account({ id: "root-1", username: "penjaga", name: "Penjaga", role: "SUPER_ADMIN" }),
      account({ id: "root-2", username: "penjaga.dua", name: "Penjaga Dua", role: "SUPER_ADMIN" }),
      account({ id: "admin-1", username: "admin.biasa", name: "Admin Biasa", role: "ADMIN" }),
      account({ id: "view-1", username: "peninjau", name: "Peninjau", role: "ANALYST", accountStatus: "PENDING", active: false }),
    ];
  });

  it("lets a super admin grant and record the super admin role", async () => {
    state.actor = state.users[0];
    const response = await patch("view-1", { role: "SUPER_ADMIN", name: "Peninjau" });
    expect(response.status).toBe(200);
    expect(state.users.find((user) => user.id === "view-1")?.role).toBe("SUPER_ADMIN");
    expect(state.audits).toEqual([
      expect.objectContaining({ action: "role_change", result: "ok", actorId: "root-1", targetId: "view-1", detail: "ANALYST -> SUPER_ADMIN" }),
    ]);
    expect(JSON.stringify(state.audits)).not.toContain(PASSWORD);
  });

  it("lets a super admin remove another super admin while one remains", async () => {
    state.actor = state.users[0];
    const response = await patch("root-2", { role: "ADMIN", name: "Penjaga Dua" });
    expect(response.status).toBe(200);
    expect(state.users.find((user) => user.id === "root-2")?.role).toBe("ADMIN");
    expect(state.audits[0]).toMatchObject({ action: "role_change", detail: "SUPER_ADMIN -> ADMIN" });
  });

  it("keeps the last active super admin in place", async () => {
    state.users = state.users.filter((user) => user.id !== "root-2");
    state.actor = state.users[0];
    const before = state.users[0].role;
    const response = await patch("root-1", { role: "ADMIN", name: "Penjaga" });
    expect(response.status).toBe(400);
    expect(state.users[0].role).toBe(before);
    expect(state.writes).toBe(0);
    expect(state.audits).toEqual([]);
  });

  it("refuses an admin grant, including a direct self promotion, without writing", async () => {
    state.actor = state.users[2];
    const other = await patch("view-1", { role: "SUPER_ADMIN", name: "Nama diubah" });
    const self = await patch("admin-1", { role: "SUPER_ADMIN", name: "Naik sendiri" });
    expect(other.status).toBe(403);
    expect(self.status).toBe(403);
    expect(state.users.find((user) => user.id === "view-1")).toMatchObject({ role: "ANALYST", name: "Peninjau" });
    expect(state.users.find((user) => user.id === "admin-1")).toMatchObject({ role: "ADMIN", name: "Admin Biasa" });
    expect(state.writes).toBe(0);
    expect(state.audits).toEqual([]);
  });

  it("refuses an admin who tries to create a super admin through the API", async () => {
    state.actor = state.users[2];
    const response = await create({ name: "Baru", username: "baru.super", password: PASSWORD, role: "SUPER_ADMIN" });
    expect(response.status).toBe(403);
    expect(state.users.some((user) => user.username === "baru.super")).toBe(false);
    expect(state.writes).toBe(0);
    expect(state.audits).toEqual([]);
    expect(JSON.stringify(await response.json())).not.toContain(PASSWORD);
  });

  it("refuses an admin who tries to remove a super admin", async () => {
    state.actor = state.users[2];
    const response = await patch("root-2", { role: "ADMIN", name: "Penjaga Dua" });
    expect(response.status).toBe(403);
    expect(state.users.find((user) => user.id === "root-2")?.role).toBe("SUPER_ADMIN");
    expect(state.writes).toBe(0);
    expect(state.audits).toEqual([]);
  });

  it("still lets an admin manage other roles and approve an account", async () => {
    state.actor = state.users[2];
    const created = await create({
      name: "Operator Uji",
      username: "operator.uji",
      password: PASSWORD,
      role: "OPERATOR_KODAM",
      kotamaopsId: "unit-xii",
    });
    expect(created.status).toBe(201);
    const approved = await patch("view-1", { role: "PIMPINAN", name: "Peninjau", accountStatus: "ACTIVE" });
    expect(approved.status).toBe(200);
    expect(state.users.find((user) => user.id === "view-1")).toMatchObject({ role: "PIMPINAN", accountStatus: "ACTIVE", active: true });
    expect(state.audits.map((entry) => entry.action)).toEqual(["account_create", "role_change", "account_approve"]);
    expect(JSON.stringify(state.audits)).not.toContain(PASSWORD);
    expect(JSON.stringify(state.audits)).not.toContain("scrypt$");
  });

  it("lets a super admin create another super admin and record the role only", async () => {
    state.actor = state.users[0];
    const response = await create({ name: "Penjaga Tiga", username: "penjaga.tiga", password: PASSWORD, role: "SUPER_ADMIN" });
    expect(response.status).toBe(201);
    expect(state.users.find((user) => user.username === "penjaga.tiga")?.role).toBe("SUPER_ADMIN");
    expect(state.audits[0]).toMatchObject({ action: "account_create", detail: "SUPER_ADMIN" });
    expect(JSON.stringify(state.audits)).not.toContain(PASSWORD);
  });

  it("refuses any admin change to a super admin account, including a password takeover", async () => {
    state.actor = state.users[2];
    for (const body of [
      { role: "SUPER_ADMIN", name: "Nama baru" },
      { role: "SUPER_ADMIN", name: "Penjaga Dua", password: "Sandi-Pengambil-Alih-1" },
      { role: "SUPER_ADMIN", name: "Penjaga Dua", accountStatus: "DISABLED" },
    ]) {
      expect((await patch("root-2", body)).status).toBe(403);
    }
    expect(state.users.find((user) => user.id === "root-2")).toMatchObject({ name: "Penjaga Dua", passwordHash: "scrypt$tersimpan", sessionVersion: 0, accountStatus: "ACTIVE" });
    expect(state.writes).toBe(0);
    expect(state.audits).toEqual([]);
  });

  it("lets a super admin reset another super admin's password", async () => {
    state.actor = state.users[0];
    const response = await patch("root-2", { role: "SUPER_ADMIN", name: "Penjaga Dua", password: "Sandi-Baru-Super-1" });
    expect(response.status).toBe(200);
    expect(state.users.find((user) => user.id === "root-2")?.sessionVersion).toBe(1);
  });

  it("refuses a new password built from the target's username without writing", async () => {
    state.actor = state.users[0];
    const response = await patch("root-2", { role: "SUPER_ADMIN", name: "Penjaga Dua", password: "Penjaga.Dua-Merapi-27" });
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("nama pengguna");
    expect(state.users.find((user) => user.id === "root-2")?.sessionVersion).toBe(0);
  });

  it("does not disable the last active super admin", async () => {
    state.users = state.users.filter((user) => user.id !== "root-2");
    state.actor = state.users.find((user) => user.id === "root-1") ?? null;
    const response = await patch("root-1", { role: "SUPER_ADMIN", name: "Penjaga", accountStatus: "DISABLED" });
    expect(response.status).toBe(400);
    expect(state.users.find((user) => user.id === "root-1")).toMatchObject({ role: "SUPER_ADMIN", active: true, accountStatus: "ACTIVE" });
    expect(state.writes).toBe(0);
    expect(state.audits).toEqual([]);
  });

  it("keeps the user list closed to an operator", async () => {
    state.actor = account({ id: "op-1", username: "operator.pusat", role: "OPERATOR_PUSDALOPS" });
    const response = await GET();
    expect(response.status).toBe(403);
    expect(state.writes).toBe(0);
  });
});
