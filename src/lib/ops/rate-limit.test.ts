import { describe, expect, it } from "vitest";
import { rateLimit, resetRateLimits } from "./rate-limit";

describe("auth rate limit", () => {
  it("blocks the attempt that crosses the window", () => {
    resetRateLimits();
    const now = 1_000_000;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect(rateLimit("login:test", 3, 1000, now + attempt).ok).toBe(true);
    }
    expect(rateLimit("login:test", 3, 1000, now + 3).ok).toBe(false);
    expect(rateLimit("login:test", 3, 1000, now + 2000).ok).toBe(true);
  });
});