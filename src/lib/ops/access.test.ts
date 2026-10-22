import { describe, expect, it } from "vitest";
import {
  acceptedNext,
  allowedNext,
  canManageUsers,
  canWriteSituation,
  deniedPage,
  homeForRole,
  mayWriteSituationRow,
  situationWriteLookup,
  nextAccountState,
  parseNewUser,
  parseRegister,
  parseSituation,
  parseUserPatch,
  portalLabel,
  portalLinks,
  registrationRole,
  seesAllKotamaops,
  situationWhere,
  superAdminRoleChangeError,
} from "./access";

describe("ops access", () => {
  it("lets national operators write and keeps analysts on read", () => {
    expect(canWriteSituation("OPERATOR_PUSDALOPS")).toBe(true);
    expect(canWriteSituation("OPERATOR_KODAM")).toBe(true);
    expect(canWriteSituation("PIMPINAN")).toBe(false);
    expect(canWriteSituation("ANALYST")).toBe(false);
    expect(canManageUsers("ADMIN")).toBe(true);
    expect(canManageUsers("OPERATOR_PUSDALOPS")).toBe(false);
    expect(seesAllKotamaops("OPERATOR_KODAM")).toBe(false);
    expect(seesAllKotamaops("PIMPINAN")).toBe(true);
  });

  it("rejects deployed personnel above the strength on hand", () => {
    const result = parseSituation({
      status: "SIAGA",
      personnel: 10,
      deployed: 11,
      incidentCount: 1,
      note: "pos jaga",
    });
    expect(result.ok).toBe(false);
  });

  it("accepts a current situation snapshot", () => {
    const result = parseSituation({
      status: "WASPADA",
      personnel: "20",
      deployed: 4,
      incidentCount: 0,
      note: "  hujan lebat  ",
    });
    expect(result).toEqual({
      ok: true,
      value: { status: "WASPADA", personnel: 20, deployed: 4, incidentCount: 0, note: "hujan lebat" },
    });
  });

  it("requires a Kotamaops when the new user is a Kodam operator", () => {
    const missing = parseNewUser({
      name: "Operator Dua Belas",
      username: "operator.xii",
      password: "kata-sandi-kuat",
      role: "OPERATOR_KODAM",
      kotamaopsId: "",
    });
    expect(missing.ok).toBe(false);
    const created = parseNewUser({
      name: "Operator Dua Belas",
      username: "Operator.XII",
      password: "kata-sandi-kuat",
      role: "OPERATOR_KODAM",
      kotamaopsId: "kodam-xii",
    });
    expect(created).toMatchObject({
      ok: true,
      value: { username: "operator.xii", kotamaopsId: "kodam-xii" },
    });
  });

  it("drops a Kotamaops binding when the role is national", () => {
    const result = parseNewUser({
      name: "Pimpinan",
      username: "pimpinan",
      password: "kata-sandi-kuat",
      role: "PIMPINAN",
      kotamaopsId: "kodam-jaya",
    });
    expect(result).toMatchObject({ ok: true, value: { kotamaopsId: null } });
  });

  it("ignores an empty password on update", () => {
    const result = parseUserPatch({ role: "ADMIN", password: "" });
    expect(result).toEqual({ ok: true, value: { role: "ADMIN" } });
  });

  it("ignores a role sent with a public registration", () => {
    const result = parseRegister({
      name: "Budi Santoso",
      username: "Budi.Ops",
      email: "Budi@Example.com",
      organization: "Kodam Jaya",
      position: "Letnan",
      password: "kata-sandi-kuat",
      confirmPassword: "kata-sandi-kuat",
      role: "SUPER_ADMIN",
      accountStatus: "ACTIVE",
    });
    expect(result).toMatchObject({
      ok: true,
      value: { username: "budi.ops", email: "budi@example.com", organization: "Kodam Jaya" },
    });
    expect(result.ok && "role" in result.value).toBe(false);
    expect(registrationRole()).toBe("ANALYST");
  });

  it("rejects a registration whose passwords differ", () => {
    const result = parseRegister({
      name: "Budi Santoso",
      username: "budi.ops",
      email: "budi@example.com",
      organization: "Kodam Jaya",
      position: "Letnan",
      password: "kata-sandi-kuat",
      confirmPassword: "kata-sandi-lain",
    });
    expect(result).toMatchObject({ ok: false, error: "Konfirmasi kata sandi tidak sama." });
  });

  it("rejects an invalid registration email", () => {
    const result = parseRegister({
      name: "Budi Santoso",
      username: "budi.ops",
      email: "bukan-email",
      organization: "Kodam Jaya",
      position: "Letnan",
      password: "kata-sandi-kuat",
      confirmPassword: "kata-sandi-kuat",
    });
    expect(result).toMatchObject({ ok: false, error: "Email tidak valid." });
  });

  it("lists only the portal pages each role may open", () => {
    const hrefs = (role: string) => portalLinks(role).map((link) => link.href);
    expect(hrefs("SUPER_ADMIN")).toEqual(["/peta", "/operator", "/pengguna"]);
    expect(hrefs("ADMIN")).toEqual(["/peta", "/operator", "/pengguna"]);
    for (const role of ["OPERATOR_PUSDALOPS", "OPERATOR_KODAM", "ANALYST", "PIMPINAN"]) {
      expect(hrefs(role)).toEqual(["/peta", "/operator"]);
      expect(deniedPage("/pengguna", role)).not.toBeNull();
    }
    expect(portalLinks("OPERATOR_KODAM")[1].label).toBe("Dasbor operator");
    expect(portalLinks("ANALYST")[1].label).toBe("Dasbor situasi");
  });

  it("maps portals without replacing the stored roles", () => {
    expect(portalLabel("ADMIN")).toBe("Admin");
    expect(portalLabel("OPERATOR_KODAM")).toBe("Operator");
    expect(portalLabel("ANALYST")).toBe("Viewer");
    expect(portalLabel("PIMPINAN")).toBe("Monitoring");
    expect(homeForRole("ADMIN")).toBe("/pengguna");
    expect(homeForRole("SUPER_ADMIN")).toBe("/pengguna");
    expect(homeForRole("OPERATOR_PUSDALOPS")).toBe("/operator");
    expect(homeForRole("OPERATOR_KODAM")).toBe("/operator");
    expect(homeForRole("ANALYST")).toBe("/peta");
    expect(homeForRole("PIMPINAN")).toBe("/peta");
    expect(allowedNext("OPERATOR_PUSDALOPS")).not.toContain("/pengguna");
    expect(allowedNext("ANALYST")).toContain("/operator");
    expect(acceptedNext("/pengguna", allowedNext("ANALYST"))).toBeNull();
    expect(acceptedNext("/pengguna", allowedNext("PIMPINAN"))).toBeNull();
    expect(acceptedNext("/pengguna", allowedNext("OPERATOR_KODAM"))).toBeNull();
    expect(acceptedNext("/pengguna", allowedNext("ADMIN"))).toBe("/pengguna");
    expect(allowedNext("OPERATOR_KODAM")).toContain("/peta");
    expect(allowedNext("ANALYST")).toContain("/peta");
    expect(allowedNext("PIMPINAN")).toContain("/peta");
    expect(allowedNext("SUPER_ADMIN")).toContain("/pengguna");
    expect(allowedNext("SUPER_ADMIN")).toContain("/peta");
    expect(acceptedNext("/peta?layers=tni_ad", ["/peta"])).toBe("/peta?layers=tni_ad");
    expect(acceptedNext("https://evil.example/peta", ["/peta"])).toBeNull();
    expect(acceptedNext("/pengguna", ["/peta"])).toBeNull();
    expect(acceptedNext("/peta?token=rahasia", ["/peta"])).toBe("/peta");
  });

  it("keeps each portal inside its situation scope", () => {
    expect(deniedPage("/pengguna", "ANALYST")).toBe("/peta");
    expect(deniedPage("/pengguna", "PIMPINAN")).toBe("/peta");
    expect(deniedPage("/pengguna", "OPERATOR_KODAM")).toBe("/operator");
    expect(deniedPage("/pengguna", "ADMIN")).toBeNull();
    expect(deniedPage("/peta", "ANALYST")).toBeNull();
    expect(deniedPage("/operator", "PIMPINAN")).toBeNull();
    expect(situationWhere("OPERATOR_KODAM", "kodam-xii")).toEqual({ kotamaopsId: "kodam-xii" });
    expect(situationWhere("OPERATOR_KODAM", null)).toEqual({ kotamaopsId: "__none__" });
    expect(situationWhere("OPERATOR_PUSDALOPS", null)).toEqual({});
    expect(situationWhere("ANALYST", null)).toEqual({});
    expect(mayWriteSituationRow("ANALYST", null, "kodam-xii")).toBe(false);
    expect(mayWriteSituationRow("PIMPINAN", null, "kodam-xii")).toBe(false);
    expect(mayWriteSituationRow("OPERATOR_KODAM", "kodam-xii", "kodam-jaya")).toBe(false);
    expect(mayWriteSituationRow("OPERATOR_KODAM", "kodam-xii", "kodam-xii")).toBe(true);
    expect(mayWriteSituationRow("OPERATOR_PUSDALOPS", null, "kodam-jaya")).toBe(true);
    expect(mayWriteSituationRow("ADMIN", null, "kodam-jaya")).toBe(true);
    expect(situationWriteLookup("OPERATOR_KODAM", "kodam-xii", null)).toBe("absent");
    expect(situationWriteLookup("OPERATOR_KODAM", "kodam-xii", "kodam-jaya")).toBe("absent");
    expect(situationWriteLookup("OPERATOR_KODAM", "kodam-xii", "kodam-xii")).toBe("allow");
    expect(situationWriteLookup("OPERATOR_PUSDALOPS", null, null)).toBe("absent");
    expect(situationWriteLookup("ADMIN", null, "kodam-jaya")).toBe("allow");
    expect(situationWriteLookup("SUPER_ADMIN", null, "kodam-jaya")).toBe("allow");
  });

  it("lets only a super admin grant or remove the super admin role", () => {
    expect(superAdminRoleChangeError("SUPER_ADMIN", "ANALYST", "SUPER_ADMIN")).toBeNull();
    expect(superAdminRoleChangeError("SUPER_ADMIN", "SUPER_ADMIN", "ADMIN")).toBeNull();
    expect(superAdminRoleChangeError("ADMIN", "ANALYST", "SUPER_ADMIN")).toBe("Hanya super admin yang dapat mengubah peran super admin.");
    expect(superAdminRoleChangeError("ADMIN", "ADMIN", "SUPER_ADMIN")).toBe("Hanya super admin yang dapat mengubah peran super admin.");
    expect(superAdminRoleChangeError("ADMIN", "SUPER_ADMIN", "ADMIN")).toBe("Hanya super admin yang dapat mengubah peran super admin.");
    expect(superAdminRoleChangeError("ADMIN", null, "SUPER_ADMIN")).toBe("Hanya super admin yang dapat mengubah peran super admin.");
    expect(superAdminRoleChangeError("ADMIN", "ANALYST", "OPERATOR_PUSDALOPS")).toBeNull();
    expect(superAdminRoleChangeError("ADMIN", "SUPER_ADMIN", "SUPER_ADMIN")).toBeNull();
  });

  it("approves a pending account only when an admin sets the status", () => {
    expect(nextAccountState({ active: false, accountStatus: "PENDING" }, { accountStatus: "ACTIVE" })).toEqual({
      active: true,
      accountStatus: "ACTIVE",
    });
    expect(nextAccountState({ active: true, accountStatus: "ACTIVE" }, { accountStatus: "REJECTED" })).toEqual({
      active: false,
      accountStatus: "REJECTED",
    });
    expect(nextAccountState({ active: true, accountStatus: "ACTIVE" }, { active: false })).toEqual({
      active: false,
      accountStatus: "DISABLED",
    });
  });
});
