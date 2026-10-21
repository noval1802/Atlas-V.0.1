import { describe, expect, it } from "vitest";
import { REMEMBER_MS, SESSION_MS, issueSession, readSession, sessionCookie } from "./session";

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
});
