import { describe, expect, it } from "vitest";
import { NKRI_CENTER, nkriZoom } from "./nkri-view";

describe("nkri view", () => {
  it("centres between Sabang and Merauke", () => {
    expect(NKRI_CENTER.lng).toBeGreaterThan(95);
    expect(NKRI_CENTER.lng).toBeLessThan(141);
  });

  it("fits the archipelago to the screen width, within 2–5", () => {
    expect(nkriZoom(1440)).toBe(4.2);
    expect(nkriZoom(1920)).toBeGreaterThan(nkriZoom(1440));
    expect(nkriZoom(390)).toBe(2.3);
    expect(nkriZoom(100)).toBe(2);
    expect(nkriZoom(10000)).toBe(5);
  });
});
