import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  canManageUsers,
  canWriteSituation,
  deniedPage,
  homeForRole,
  mayWriteSituationRow,
  sessionMatchesUser,
  situationWhere,
  situationWriteLookup,
} from "./access";
import { issueSession, readSession } from "./session";

const state = vi.hoisted(() => ({
  actor: null as { id: string; name: string; role: string; kotamaopsId: string | null } | null,
  reads: 0,
  writes: 0,
  wheres: [] as unknown[],
}));

vi.mock("@/lib/ops/current-user", () => ({
  currentUser: async () => state.actor,
  presentUser: (user: Record<string, unknown>) => user,
}));

vi.mock("@/lib/ops/db", () => ({
  opsDb: () => ({
    situation: {
      findMany: async ({ where }: { where: unknown }) => {
        state.reads += 1;
        state.wheres.push(where);
        return [];
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        state.reads += 1;
        if (where.id === "sit-xii") {
          return {
            id: "sit-xii",
            kotamaopsId: "unit-xii",
            kotamaops: { code: "XII/TPR", name: "Tanjungpura", region: "r", location: "l" },
          };
        }
        if (where.id === "sit-jaya") {
          return {
            id: "sit-jaya",
            kotamaopsId: "unit-jaya",
            kotamaops: { code: "JAYA", name: "Jaya", region: "r", location: "l" },
          };
        }
        return null;
      },
    },
    authAudit: { findMany: async () => [] },
    user: { findMany: async () => [] },
    kotamaops: { findMany: async () => [] },
    $transaction: async (run: (tx: {
      situation: { update: () => Promise<Record<string, unknown>> };
      situationRevision: { create: () => Promise<Record<string, unknown>> };
    }) => Promise<unknown>) => {
      state.writes += 1;
      return run({
        situation: {
          update: async () => ({
            id: "sit-xii",
            kotamaopsId: "unit-xii",
            kotamaops: { code: "XII/TPR", name: "Tanjungpura", region: "r", location: "l" },
            status: "WASPADA",
            personnel: 2,
            deployed: 1,
            incidentCount: 0,
            note: "",
            updatedByName: state.actor?.name ?? "",
            updatedAt: new Date("2026-10-14T00:00:00.000Z"),
          }),
        },
        situationRevision: { create: async () => ({}) },
      });
    },
  }),
}));

import { GET as listAudit } from "@/app/api/ops/audit/route";
import { PATCH as patchSituation } from "@/app/api/ops/situations/[id]/route";
import { GET as listSituations } from "@/app/api/ops/situations/route";
import { GET as listUsers } from "@/app/api/ops/users/route";

const ROLES = ["SUPER_ADMIN", "ADMIN", "OPERATOR_PUSDALOPS", "OPERATOR_KODAM", "ANALYST", "PIMPINAN"] as const;

function actor(role: (typeof ROLES)[number], kotamaopsId: string | null = null) {
  state.actor = { id: `user-${role}`, name: "Penguji", role, kotamaopsId };
}

function save(id: string) {
  return patchSituation(new Request("http://osiris.local/api/ops/situations/" + id, {
    method: "PATCH",
    body: JSON.stringify({ status: "WASPADA", personnel: 2, deployed: 1, incidentCount: 0, note: "" }),
  }), { params: Promise.resolve({ id }) });
}

describe("RBAC fixture integration", () => {
  beforeEach(() => {
    state.actor = null;
    state.reads = 0;
    state.writes = 0;
    state.wheres = [];
  });

  it("sends every role to its own home and page", () => {
    expect(ROLES.map((role) => homeForRole(role))).toEqual([
      "/pengguna",
      "/pengguna",
      "/operator",
      "/operator",
      "/peta",
      "/peta",
    ]);
    for (const role of ["OPERATOR_PUSDALOPS", "OPERATOR_KODAM", "ANALYST", "PIMPINAN"] as const) {
      expect(deniedPage("/pengguna", role)).toBe(homeForRole(role));
      expect(deniedPage("/peta", role)).toBeNull();
      expect(deniedPage("/operator", role)).toBeNull();
    }
    expect(deniedPage("/pengguna", "ADMIN")).toBeNull();
    expect(deniedPage("/pengguna", "SUPER_ADMIN")).toBeNull();
  });

  it("keeps user, audit, and token administration to the two admin roles", async () => {
    for (const role of ROLES) {
      actor(role);
      const users = await listUsers();
      const audits = await listAudit();
      const allowed = canManageUsers(role);
      expect(users.status).toBe(allowed ? 200 : 403);
      expect(audits.status).toBe(allowed ? 200 : 403);
    }
  });

  it("filters and writes situations from the session role, not from a client unit", async () => {
    for (const role of ["SUPER_ADMIN", "ADMIN", "OPERATOR_PUSDALOPS", "ANALYST", "PIMPINAN"] as const) {
      actor(role, null);
      expect(situationWhere(role, null)).toEqual({});
      expect(mayWriteSituationRow(role, null, "unit-jaya")).toBe(canWriteSituation(role));
    }
    actor("OPERATOR_KODAM", "unit-xii");
    await listSituations();
    expect(state.wheres.at(-1)).toEqual({ kotamaopsId: "unit-xii" });
    actor("OPERATOR_KODAM", null);
    await listSituations();
    expect(state.wheres.at(-1)).toEqual({ kotamaopsId: "__none__" });

    actor("ANALYST", null);
    state.reads = 0;
    const viewer = await save("sit-jaya");
    expect(viewer.status).toBe(403);
    expect(state.reads).toBe(0);
    expect(state.writes).toBe(0);

    actor("PIMPINAN", null);
    const monitoring = await save("sit-xii");
    expect(monitoring.status).toBe(403);
    expect(state.writes).toBe(0);

    actor("OPERATOR_KODAM", "unit-xii");
    const foreign = await save("sit-jaya");
    const missing = await save("tidak-ada");
    expect(foreign.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(await foreign.json()).toEqual(await missing.json());
    expect(state.writes).toBe(0);
    expect(situationWriteLookup("OPERATOR_KODAM", "unit-xii", "unit-jaya")).toBe("absent");

    const own = await save("sit-xii");
    expect(own.status).toBe(200);
    expect(state.writes).toBe(1);

    actor("OPERATOR_PUSDALOPS", null);
    const pusat = await save("sit-jaya");
    expect(pusat.status).toBe(200);
    expect(state.writes).toBe(2);
  });

  it("rejects a pending, disabled, mismatched, or expired session", async () => {
    expect(sessionMatchesUser({ ver: 1 }, { active: false, accountStatus: "PENDING", sessionVersion: 1 })).toBe(false);
    expect(sessionMatchesUser({ ver: 1 }, { active: false, accountStatus: "DISABLED", sessionVersion: 1 })).toBe(false);
    expect(sessionMatchesUser({ ver: 1 }, { active: true, accountStatus: "ACTIVE", sessionVersion: 2 })).toBe(false);
    expect(sessionMatchesUser({ ver: 2 }, { active: true, accountStatus: "ACTIVE", sessionVersion: 2 })).toBe(true);
    const now = 1_700_000_000_000;
    const token = await issueSession("user-1", "rahasia-uji", now, { version: 3 });
    await expect(readSession(token, "rahasia-uji", now + 60_000)).resolves.toMatchObject({ sub: "user-1", ver: 3 });
    await expect(readSession(token, "rahasia-uji", now + 8 * 60 * 60 * 1000)).resolves.toBeNull();
    await expect(readSession(token, "rahasia-lain", now)).resolves.toBeNull();
    await expect(readSession("bukan-sesi", "rahasia-uji", now)).resolves.toBeNull();
  });
});
