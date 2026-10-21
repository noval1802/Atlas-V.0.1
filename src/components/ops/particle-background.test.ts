import { describe, expect, it } from "vitest";
import { particleCountForViewport } from "./ParticleBackground";

describe("login particle field", () => {
  it("uses the reference count on a 1440 by 900 screen", () => {
    expect(particleCountForViewport(1440, 900)).toBe(120);
  });

  it("thins the field on a tablet and never exceeds 120", () => {
    expect(particleCountForViewport(1024, 768)).toBeLessThan(120);
    expect(particleCountForViewport(1024, 768)).toBeGreaterThanOrEqual(24);
    expect(particleCountForViewport(3840, 2160)).toBe(120);
  });

  it("draws nothing for an empty viewport", () => {
    expect(particleCountForViewport(0, 900)).toBe(0);
  });
});
