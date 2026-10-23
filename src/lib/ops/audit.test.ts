import { describe, expect, it } from "vitest";
import { sessionMatchesUser } from "./access";
import { requestIp, scrubDetail } from "./audit";

describe("auth audit", () => {
  it("redacts password hashes and session cookies", () => {
    const text = scrubDetail("gagal scrypt$salt$hash osiris_ops=token.rahasia bearer abc");
    expect(text).not.toContain("scrypt$");
    expect(text).not.toContain("osiris_ops=");
    expect(text).not.toContain("bearer abc");
    expect(text).toContain("[redacted]");
  });

  it("drops a forwarded header that is not an address", () => {
    const request = new Request("http://osiris.local", { headers: { "x-forwarded-for": "203.0.113.8, kata sandi" } });
    expect(requestIp(request)).toBe("");
  });

  it("ignores the client-written left hop and prefers the proxy's own headers", () => {
    const spoofed = (headers: Record<string, string>) => requestIp(new Request("http://osiris.local", { headers }));
    expect(spoofed({ "x-forwarded-for": "1.2.3.4, 203.0.113.8" })).toBe("203.0.113.8");
    expect(spoofed({ "x-forwarded-for": "1.2.3.4, 203.0.113.8", "x-real-ip": "198.51.100.7" })).toBe("198.51.100.7");
  });
});

describe("session match", () => {
  it("rejects a pending account and a stale session version", () => {
    expect(sessionMatchesUser({ ver: 0 }, { active: false, accountStatus: "PENDING", sessionVersion: 0 })).toBe(false);
    expect(sessionMatchesUser({ ver: 1 }, { active: true, accountStatus: "ACTIVE", sessionVersion: 2 })).toBe(false);
    expect(sessionMatchesUser({ ver: 2 }, { active: true, accountStatus: "ACTIVE", sessionVersion: 2 })).toBe(true);
    expect(sessionMatchesUser({}, { active: true, accountStatus: "ACTIVE", sessionVersion: 0 })).toBe(true);
  });
});