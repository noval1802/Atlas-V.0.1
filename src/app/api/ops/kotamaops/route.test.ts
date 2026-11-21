import { beforeEach, describe, expect, it, vi } from "vitest";
import { logoFileName, sniffLogo } from "@/lib/ops/kotamaops-logo";

const state = vi.hoisted(() => ({
  actor: null as { id: string; name: string; role: string; kotamaopsId: string | null } | null,
  units: new Map<string, Record<string, unknown>>(),
  deleted: [] as string[],
  stored: [] as string[],
  discarded: [] as string[],
}));

vi.mock("@/lib/ops/current-user", () => ({ currentUser: async () => state.actor }));
vi.mock("@/lib/ops/audit", () => ({ requestIp: () => "", writeAudit: async () => undefined }));
vi.mock("@/lib/ops/kotamaops-logo", async (real) => ({
  ...(await real<typeof import("@/lib/ops/kotamaops-logo")>()),
  storeLogo: async (code: string, _bytes: Uint8Array, kind: string) => {
    const url = `/api/ops/kotamaops/logo/${code.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-abcd1234.${kind}`;
    state.stored.push(url);
    return url;
  },
  discardLogo: async (url: string) => {
    if (url) state.discarded.push(url);
  },
}));

const situationOf = (id: string) => ({
  id: `sit-${id}`,
  kotamaopsId: id,
  status: "KONDUSIF",
  personnel: 0,
  deployed: 0,
  incidentCount: 0,
  note: "Belum ada laporan.",
  updatedByName: "op",
  updatedAt: new Date("2026-11-21T00:00:00Z"),
});
const full = (unit: Record<string, unknown>) => ({ ...unit, situation: situationOf(String(unit.id)), _count: { users: Number(unit.users ?? 0) } });
const byCode = (code: unknown) => [...state.units.values()].find((unit) => unit.code === code) ?? null;

vi.mock("@/lib/ops/db", () => {
  const kotamaops = {
    findUnique: async ({ where }: { where: { id?: string; code?: string } }) => {
      const unit = where.id ? state.units.get(where.id) : byCode(where.code);
      return unit ? full(unit) : null;
    },
    findUniqueOrThrow: async ({ where }: { where: { id: string } }) => full(state.units.get(where.id)!),
    findMany: async () => [...state.units.values()].map(full),
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const unit = { id: `u${state.units.size + 1}`, ...data };
      state.units.set(String(unit.id), unit);
      return unit;
    },
    update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      const unit = { ...state.units.get(where.id)!, ...data };
      state.units.set(where.id, unit);
      return full(unit);
    },
    delete: async ({ where }: { where: { id: string } }) => {
      state.deleted.push(where.id);
      state.units.delete(where.id);
    },
  };
  const db = { kotamaops, situation: { create: async () => ({}) } };
  return { opsDb: () => ({ ...db, $transaction: async (run: (tx: typeof db) => unknown) => run(db) }) };
});

import { GET, POST } from "./route";
import { DELETE, PATCH } from "./[id]/route";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const fields = { code: "xxv/con", name: "Kodam XXV/Contoh", region: "Papua Tengah", location: "Nabire", latitude: "-3,36", longitude: "135.5", matra: "AD" };

function form(values: Record<string, string>, logo?: Uint8Array) {
  const body = new FormData();
  for (const [key, value] of Object.entries(values)) body.set(key, value);
  if (logo) body.set("logo", new File([logo as BlobPart], "lambang.png"));
  return body;
}
const post = (body: FormData) => POST(new Request("http://atlas.local/api/ops/kotamaops", { method: "POST", body }));
const patch = (id: string, body: FormData) =>
  PATCH(new Request(`http://atlas.local/api/ops/kotamaops/${id}`, { method: "PATCH", body }), { params: Promise.resolve({ id }) });
const del = (id: string) => DELETE(new Request(`http://atlas.local/api/ops/kotamaops/${id}`, { method: "DELETE" }), { params: Promise.resolve({ id }) });
const as = (role: string) => {
  state.actor = { id: "actor", name: "Petugas", role, kotamaopsId: role === "OPERATOR_KODAM" ? "u1" : null };
};

beforeEach(() => {
  state.units.clear();
  state.deleted = [];
  state.stored = [];
  state.discarded = [];
  as("OPERATOR_PUSDALOPS");
});

describe("kotamaops logo files", () => {
  it("knows images by their bytes, not their names", () => {
    expect(sniffLogo(PNG)).toBe("png");
    expect(sniffLogo(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpg");
    expect(sniffLogo(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe("webp");
    expect(sniffLogo(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    expect(logoFileName("jaya-1a2b3c4d.png")).toBe("jaya-1a2b3c4d.png");
    expect(logoFileName("../.env")).toBeNull();
    expect(logoFileName("x.svg")).toBeNull();
  });
});

describe("/api/ops/kotamaops", () => {
  it("keeps viewers and Kodam operators out of add, edit, and list", async () => {
    for (const role of ["ANALYST", "PIMPINAN", "OPERATOR_KODAM"]) {
      as(role);
      expect((await post(form(fields))).status).toBe(403);
      expect((await GET()).status).toBe(403);
      expect((await patch("u1", form(fields))).status).toBe(403);
    }
    expect(state.units.size).toBe(0);
  });

  it("adds a unit with its logo and a first situation row", async () => {
    const response = await post(form(fields, PNG));
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.unit).toMatchObject({ code: "XXV/CON", latitude: -3.36, logo: "/api/ops/kotamaops/logo/xxv-con-abcd1234.png" });
    expect(body.row).toMatchObject({ code: "XXV/CON", status: "KONDUSIF", note: "Belum ada laporan." });
    expect((await post(form(fields))).status).toBe(409);
  });

  it("refuses a file that is not an image", async () => {
    const response = await post(form(fields, new TextEncoder().encode("<svg/>")));
    expect(response.status).toBe(400);
    expect(state.units.size).toBe(0);
  });

  it("edits fields, replaces the logo, and drops the old file", async () => {
    await post(form(fields, PNG));
    const renamed = await patch("u1", form({ ...fields, code: "XXV/BARU", location: "Timika" }, PNG));
    expect(renamed.status).toBe(200);
    const body = await renamed.json();
    expect(body.unit).toMatchObject({ code: "XXV/BARU", location: "Timika", logo: "/api/ops/kotamaops/logo/xxv-baru-abcd1234.png" });
    expect(body.row).toMatchObject({ code: "XXV/BARU", location: "Timika" });
    expect(state.discarded).toEqual(["/api/ops/kotamaops/logo/xxv-con-abcd1234.png"]);

    const cleared = await (await patch("u1", form({ ...fields, code: "XXV/BARU", removeLogo: "1" }))).json();
    expect(cleared.unit.logo).toBe("");

    await post(form({ ...fields, code: "LAIN" }));
    expect((await patch("u1", form({ ...fields, code: "lain" }))).status).toBe(409);
    expect((await patch("nope", form(fields))).status).toBe(404);
  });

  it("lets only admins delete, and never a unit with bound accounts", async () => {
    await post(form(fields, PNG));
    expect((await del("u1")).status).toBe(403);
    as("ADMIN");
    state.units.get("u1")!.users = 2;
    expect((await del("u1")).status).toBe(409);
    state.units.get("u1")!.users = 0;
    const response = await del("u1");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: "u1", situationId: "sit-u1" });
    expect(state.deleted).toEqual(["u1"]);
    expect(state.discarded).toContain("/api/ops/kotamaops/logo/xxv-con-abcd1234.png");
  });
});
