import { describe, expect, it } from "vitest";
import {
  KOTAMAOPS_FLAME_FRAMES,
  KOTAMAOPS_FLAME_FRAME_MS,
  kotamaopsFlameImageId,
  nextKotamaopsFlameFrame,
} from "./kotamaops-flame";

describe("kotamaops flame", () => {
  it("reuses one short frame list", () => {
    expect(KOTAMAOPS_FLAME_FRAMES).toBe(8);
    expect(KOTAMAOPS_FLAME_FRAME_MS).toBeGreaterThanOrEqual(80);
    expect(nextKotamaopsFlameFrame(0)).toBe(1);
    expect(nextKotamaopsFlameFrame(7)).toBe(0);
    expect(kotamaopsFlameImageId(8)).toBe("kotamaops-flame-0");
  });
});
