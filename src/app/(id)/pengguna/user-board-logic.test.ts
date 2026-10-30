import { describe, expect, it } from "vitest";
import {
  ago,
  auditOutcome,
  decisionBody,
  draftFrom,
  editBody,
  filterAudits,
  filterUsers,
  initials,
  lockedForActor,
  riskyChanges,
  roleChoices,
  type AuditRow,
  type UserRow,
} from "./user-board-logic";

function user(partial: Partial<UserRow> & Pick<UserRow, "id" | "name" | "username" | "role">): UserRow {
  return {
    email: null,
    organization: "",
    position: "",
    active: true,
    accountStatus: "ACTIVE",
    kotamaopsId: null,
    kotamaops: null,
    lastLoginAt: null,
    createdAt: "2026-10-28T00:00:00.000Z",
    ...partial,
  };
}

const KODAM = user({ id: "k", name: "Kodam Satu", username: "kodam.satu", role: "OPERATOR_KODAM", kotamaopsId: "unit-1" });

describe("user board payloads", () => {
  it("sends exactly one of active or accountStatus", () => {
    const edit = editBody(draftFrom(KODAM));
    expect("active" in edit && !("accountStatus" in edit)).toBe(true);
    const decision = decisionBody(KODAM, "DISABLED");
    expect("accountStatus" in decision && !("active" in decision)).toBe(true);
  });

  it("sends kotamaopsId only for OPERATOR_KODAM", () => {
    expect(editBody(draftFrom(KODAM)).kotamaopsId).toBe("unit-1");
    expect(editBody({ ...draftFrom(KODAM), role: "ANALYST" }).kotamaopsId).toBeNull();
    expect(decisionBody({ ...KODAM, role: "ADMIN" }, "ACTIVE").kotamaopsId).toBeNull();
  });

  it("builds a decision from the saved row, never from unsaved edits, and never with a password", () => {
    const body = decisionBody(KODAM, "REJECTED");
    expect(body).toEqual({ name: "Kodam Satu", role: "OPERATOR_KODAM", kotamaopsId: "unit-1", password: "", confirmPassword: "", accountStatus: "REJECTED" });
  });

  it("carries the password and its confirmation together", () => {
    const body = editBody({ ...draftFrom(KODAM), password: "Merapi-Kabut-Pagi-27", confirmPassword: "Merapi-Kabut-Pagi-28" });
    expect(body).toMatchObject({ password: "Merapi-Kabut-Pagi-27", confirmPassword: "Merapi-Kabut-Pagi-28" });
  });
});

describe("risky change confirmation", () => {
  it("lists role, password and activation changes and nothing for a rename", () => {
    expect(riskyChanges(KODAM, { ...draftFrom(KODAM), name: "Baru" })).toEqual([]);
    const all = riskyChanges(KODAM, { ...draftFrom(KODAM), role: "ADMIN", password: "x", active: false });
    expect(all).toHaveLength(3);
    expect(all.join(" ")).toContain("sesi");
    expect(riskyChanges({ ...KODAM, active: false }, { ...draftFrom(KODAM), active: true })[0]).toContain("diaktifkan");
  });
});

describe("role rules", () => {
  it("never offers SUPER_ADMIN to an admin and locks super admin rows for them", () => {
    expect(roleChoices("ADMIN").map(([role]) => role)).not.toContain("SUPER_ADMIN");
    expect(roleChoices("SUPER_ADMIN").map(([role]) => role)).toContain("SUPER_ADMIN");
    expect(roleChoices("ADMIN", "SUPER_ADMIN").map(([role]) => role)).toEqual(["SUPER_ADMIN"]);
    expect(lockedForActor("ADMIN", { role: "SUPER_ADMIN" })).toBe(true);
    expect(lockedForActor("SUPER_ADMIN", { role: "SUPER_ADMIN" })).toBe(false);
  });
});

describe("filters", () => {
  const rows = [
    user({ id: "1", name: "Citra Sari", username: "citra.s", email: "citra@example.com", role: "OPERATOR_PUSDALOPS", lastLoginAt: "2026-10-29T00:00:00Z" }),
    user({ id: "2", name: "Budi Santoso", username: "budi.s", role: "ADMIN", lastLoginAt: "2026-10-30T00:00:00Z" }),
    user({ id: "3", name: "Dedi Wirawan", username: "dedi.w", role: "ANALYST", accountStatus: "DISABLED", active: false }),
  ];

  it("searches name, username and email, and filters by role and status", () => {
    expect(filterUsers(rows, { query: "EXAMPLE", role: "", status: "", sort: "name-asc" }).map((r) => r.id)).toEqual(["1"]);
    expect(filterUsers(rows, { query: "", role: "ADMIN", status: "", sort: "name-asc" }).map((r) => r.id)).toEqual(["2"]);
    expect(filterUsers(rows, { query: "", role: "", status: "DISABLED", sort: "name-asc" }).map((r) => r.id)).toEqual(["3"]);
  });

  it("sorts by name both ways and by last login with never-logged-in last", () => {
    expect(filterUsers(rows, { query: "", role: "", status: "", sort: "name-asc" }).map((r) => r.id)).toEqual(["2", "1", "3"]);
    expect(filterUsers(rows, { query: "", role: "", status: "", sort: "name-desc" }).map((r) => r.id)).toEqual(["3", "1", "2"]);
    expect(filterUsers(rows, { query: "", role: "", status: "", sort: "login-desc" }).map((r) => r.id)).toEqual(["2", "1", "3"]);
  });

  it("filters audit rows by age, action and either side of the event", () => {
    const now = Date.parse("2026-10-30T00:00:00Z");
    const audits: AuditRow[] = [
      { id: "a", at: "2026-10-29T23:00:00Z", action: "login_success", label: "", result: "ok", actor: "admin", target: "admin", ip: "", detail: "" },
      { id: "b", at: "2026-10-20T00:00:00Z", action: "login_failure", label: "", result: "denied", actor: null, target: "budi.s", ip: "", detail: "" },
    ];
    expect(filterAudits(audits, { days: 1, action: "", user: "" }, now).map((r) => r.id)).toEqual(["a"]);
    expect(filterAudits(audits, { days: 0, action: "login_failure", user: "" }, now).map((r) => r.id)).toEqual(["b"]);
    expect(filterAudits(audits, { days: 0, action: "", user: "budi.s" }, now).map((r) => r.id)).toEqual(["b"]);
  });
});

describe("formatting", () => {
  it("makes initials and relative times", () => {
    expect(initials("Andi Darmawan")).toBe("AD");
    expect(initials("admin")).toBe("AD");
    const now = Date.parse("2026-10-30T12:00:00Z");
    expect(ago("2026-10-30T11:59:40Z", now)).toBe("Baru saja");
    expect(ago("2026-10-30T02:00:00Z", now)).toContain("10 jam");
  });
  it("labels audit results Berhasil/Menunggu/Gagal without touching the raw value", () => {
    expect(auditOutcome("ok")).toEqual({ label: "Berhasil", tone: "ok" });
    expect(auditOutcome("sent").label).toBe("Berhasil");
    expect(auditOutcome("pending").label).toBe("Menunggu");
    for (const raw of ["denied", "inactive", "rate_limited", "mail_failed", "duplicate"]) expect(auditOutcome(raw).label).toBe("Gagal");
  });
});
