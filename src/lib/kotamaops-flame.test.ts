import { describe, expect, it } from "vitest";
import { karhutlaReports } from "./karhutla-lapsit";
import {
  KOTAMAOPS_FLAME_CODES,
  KOTAMAOPS_FLAME_FRAMES,
  KOTAMAOPS_FLAME_FRAME_MS,
  kotamaopsFlameImageId,
  kotamaopsHasFlame,
  nextKotamaopsFlameFrame,
} from "./kotamaops-flame";

describe("kotamaops flame", () => {
  it("reuses one short frame list for Kodam that still have fire spots", () => {
    expect(KOTAMAOPS_FLAME_CODES).toEqual(["XXII/TB", "II/SWJ", "XXI/RI", "XVIII/KSR", "XX/TIB", "IV/DIP"]);
    expect(karhutlaReports().filter((item) => (item.prosesTitik ?? 0) > 0).map((item) => item.code)).toEqual(KOTAMAOPS_FLAME_CODES);
    expect(kotamaopsHasFlame("XXII/TB")).toBe(true);
    expect(kotamaopsHasFlame("IV/DIP")).toBe(true);
    expect(kotamaopsHasFlame("IX/UDY")).toBe(false);
    expect(kotamaopsHasFlame("XII/TPR")).toBe(false);
    expect(kotamaopsHasFlame("V/BRW")).toBe(false);
    expect(kotamaopsHasFlame("IM")).toBe(false);
    expect(kotamaopsHasFlame("JAYA")).toBe(false);
    expect(kotamaopsHasFlame("KODAERAL V")).toBe(false);
    expect(KOTAMAOPS_FLAME_FRAMES).toBe(8);
    expect(KOTAMAOPS_FLAME_FRAME_MS).toBeGreaterThanOrEqual(80);
    expect(nextKotamaopsFlameFrame(0)).toBe(1);
    expect(nextKotamaopsFlameFrame(7)).toBe(0);
    expect(kotamaopsFlameImageId(8)).toBe("kotamaops-flame-0");
  });
});
