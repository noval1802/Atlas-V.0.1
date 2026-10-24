import { describe, expect, it } from "vitest";
import { REMEMBER_MS, SESSION_MS, issueSession, readSession, sessionCookie, sessionSecret } from "./session";

describe("ops session", () => {
  it("round-trips a signed cookie and rejects a different secret", async () => {
    const token = await issueSession("user-1", "rahasia-sesi");
    await expect(readSession(token, "rahasia-sesi", 0)).resolves.toMatchObject({ sub: "user-1", ver: 0 });
    await expect(readSession(token, "rahasia-lain", 0)).resolves.toBeNull();
    await expect(readSession(token, "rahasia-sesi", Date.now() + 9 * 60 * 60 * 1000)).resolves.toBeNull();
  });

  it("keeps a remember-me session for 14 days and no longer", async () => {
    const now = 1_700_000_000_000;
    const token = await issueSession("user-1", "rahasia-sesi", now, { remember: true, version: 4 });
    await expect(readSession(token, "rahasia-sesi", now + REMEMBER_MS - 1000)).resolves.toMatchObject({ sub: "user-1", ver: 4 });
    await expect(readSession(token, "rahasia-sesi", now + REMEMBER_MS)).resolves.toBeNull();
    expect(sessionCookie(token, REMEMBER_MS / 1000)).toContain("HttpOnly");
    expect(sessionCookie(token, REMEMBER_MS / 1000)).toContain("SameSite=Lax");
    expect(sessionCookie(token, SESSION_MS / 1000)).toContain("Max-Age=28800");
    expect(sessionCookie(token, REMEMBER_MS / 1000)).toContain("Max-Age=1209600");
  });

  it("treats a secret shorter than 32 characters as unset", () => {
    const before = process.env.OPS_SESSION_SECRET;
    try {
      process.env.OPS_SESSION_SECRET = "pendek";
      expect(sessionSecret()).toBe("");
      process.env.OPS_SESSION_SECRET = "x".repeat(32);
      expect(sessionSecret()).toBe("x".repeat(32));
    } finally {
      if (before === undefined) delete process.env.OPS_SESSION_SECRET;
      else process.env.OPS_SESSION_SECRET = before;
    }
  });
});
