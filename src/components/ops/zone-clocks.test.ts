import { describe, expect, it } from "vitest";
import { zoneTime } from "./zone-clocks";

describe("zoneTime", () => {
  it("shows WIB, WITA and WIT one hour apart and wraps past midnight", () => {
    const at = new Date("2026-10-22T16:30:00Z");
    expect(zoneTime(at, 7)).toBe("23.30");
    expect(zoneTime(at, 8)).toBe("00.30");
    expect(zoneTime(at, 9)).toBe("01.30");
  });
});
