import { describe, expect, it } from "vitest";
import { assessReset, hashResetToken, newResetToken, resetFailureMessage } from "./reset-token";

describe("password reset tokens", () => {
  it("stores a hash that is not the token", () => {
    const issued = newResetToken();
    expect(issued.tokenHash).toBe(hashResetToken(issued.token));
    expect(issued.tokenHash).not.toBe(issued.token);
    expect(issued.tokenHash).not.toContain(issued.token);
  });

  it("distinguishes a live token from an expired or reused one", () => {
    const now = 1_700_000_000_000;
    expect(assessReset(null, now)).toBe("missing");
    expect(assessReset({ usedAt: null, expiresAt: new Date(now + 1000) }, now)).toBe("ok");
    expect(assessReset({ usedAt: null, expiresAt: new Date(now) }, now)).toBe("expired");
    expect(assessReset({ usedAt: new Date(now - 1), expiresAt: new Date(now + 1000) }, now)).toBe("used");
    expect(resetFailureMessage("expired")).toBe("Tautan reset sudah kedaluwarsa.");
    expect(resetFailureMessage("used")).toBe("Tautan reset sudah dipakai.");
  });
});