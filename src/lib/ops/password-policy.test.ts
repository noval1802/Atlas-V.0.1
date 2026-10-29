import { describe, expect, it } from "vitest";
import { parseNewUser, parseRegister, parseUserPatch, passwordError } from "@/lib/ops/access";
import { planAdminBootstrap } from "../../../prisma/admin-bootstrap.mjs";

describe("password policy", () => {
  it("accepts a long password unrelated to the account or the system", () => {
    expect(passwordError("Merapi-Kabut-Pagi-27")).toBeNull();
    expect(passwordError("Merapi-Kabut-Pagi-27", "budi.ops")).toBeNull();
  });

  it("requires at least 12 characters", () => {
    expect(passwordError("Kabut-Pagi1")).toContain("minimal 12");
    expect(passwordError("Kabut-Pagi12")).toBeNull();
  });

  it("refuses a password containing the username, in any case", () => {
    expect(passwordError("BUDI.OPS-merapi-27", "budi.ops")).toContain("nama pengguna");
  });

  it("refuses system and role names and common patterns", () => {
    for (const weak of ["Atlas-Merapi-2026", "Rahasia-OSIRIS-1", "SuperAdmin-Kuat-9", "Password-Merapi", "a1234567890bc"]) {
      expect(passwordError(weak)).toContain("mudah ditebak");
    }
  });

  it("refuses one repeated character", () => {
    expect(passwordError("zzzzzzzzzzzzzzzz")).toContain("diulang");
  });

  it("still caps the length", () => {
    expect(passwordError("x".repeat(150) + "Merapi-Kabut-Pagi".repeat(4))).toContain("terlalu panjang");
  });

  it("applies to registration and user creation with the submitted username", () => {
    const register = parseRegister({
      name: "Budi Santoso",
      username: "budi.ops",
      email: "budi@example.com",
      organization: "Kodam Jaya",
      position: "Letnan",
      password: "budi.ops-merapi-27",
      confirmPassword: "budi.ops-merapi-27",
    });
    expect(register).toEqual({ ok: false, error: "Kata sandi tidak boleh memuat nama pengguna." });
    const created = parseNewUser({ name: "Budi", username: "budi.ops", password: "Kabut-Pagi1", role: "ANALYST" });
    expect(created).toEqual({ ok: false, error: "Kata sandi minimal 12 karakter." });
  });

  it("applies to a password change and still allows a patch without one", () => {
    expect(parseUserPatch({ password: "Atlas-Merapi-2026" }).ok).toBe(false);
    expect(parseUserPatch({ password: "" }).ok).toBe(true);
    expect(parseUserPatch({ name: "Budi" }).ok).toBe(true);
  });
});

describe("admin bootstrap", () => {
  const strong = { username: "penjaga", password: "Merapi-Kabut-Pagi-27" };

  it("creates the first super admin from a strong password", () => {
    expect(planAdminBootstrap({ activeSuperAdmins: 0, usernameTaken: false, ...strong })).toEqual({ action: "create" });
  });

  it("never touches an existing super admin, even when .env carries a password", () => {
    const plan = planAdminBootstrap({ activeSuperAdmins: 1, usernameTaken: true, ...strong });
    expect(plan.action).toBe("skip");
    expect(plan.action === "skip" && plan.notice).toContain("tidak merotasi");
  });

  it("does not add a second super admin when the username in .env changes", () => {
    expect(planAdminBootstrap({ activeSuperAdmins: 1, usernameTaken: false, username: "penjaga.baru", password: strong.password }).action).toBe("skip");
  });

  it("lets .env drop both values once a super admin exists", () => {
    expect(planAdminBootstrap({ activeSuperAdmins: 1, usernameTaken: false, username: "", password: "" })).toEqual({ action: "skip", notice: null });
  });

  it("refuses to bootstrap without credentials or with a weak password", () => {
    expect(planAdminBootstrap({ activeSuperAdmins: 0, usernameTaken: false, username: "", password: "" }).action).toBe("error");
    const weak = planAdminBootstrap({ activeSuperAdmins: 0, usernameTaken: false, username: "penjaga", password: "admin-atlas-1" });
    expect(weak).toEqual({ action: "error", message: expect.stringContaining("OPS_ADMIN_PASSWORD ditolak") });
  });

  it("refuses to take over an existing account when no super admin is active", () => {
    const plan = planAdminBootstrap({ activeSuperAdmins: 0, usernameTaken: true, ...strong });
    expect(plan).toEqual({ action: "error", message: expect.stringContaining("sudah dipakai akun lain") });
  });

  it("never echoes the password in a message", () => {
    const plans = [
      planAdminBootstrap({ activeSuperAdmins: 1, usernameTaken: true, ...strong }),
      planAdminBootstrap({ activeSuperAdmins: 0, usernameTaken: true, ...strong }),
      planAdminBootstrap({ activeSuperAdmins: 0, usernameTaken: false, username: "penjaga", password: "penjaga-merapi-27" }),
    ];
    for (const plan of plans) expect(JSON.stringify(plan)).not.toContain("merapi");
  });
});
