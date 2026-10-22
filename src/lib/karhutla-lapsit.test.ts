import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const seedCodes = [...readFileSync(new URL("../../prisma/seed.mjs", import.meta.url), "utf8").matchAll(/^ {2}\["([^"]+)"/gm)].map(([, code]) => code);
import {
  formatKarhutlaAmount,
  formatPersonel,
  karhutlaReport,
  karhutlaReports,
} from "./karhutla-lapsit";

describe("karhutla lapsit", () => {
  it("keeps Tambun Bungai's 150 opening fire spots split into extinguished and active", () => {
    const report = karhutlaReport("XXII/TB");
    expect(report).toMatchObject({
      awalTitik: 150,
      awalHa: 196.96,
      padamTitik: 83,
      padamHa: 104.23,
      prosesTitik: 67,
      prosesHa: 92.73,
      personelSiaga: 2384,
    });
    expect(formatKarhutlaAmount(report!.awalTitik, report!.awalHa)).toBe("150 titik · 196,96 Ha");
    expect(formatPersonel(report!.personelSiaga)).toBe("2.384");
  });

  it("balances every counted report and leaves unaffected commands out", () => {
    expect(karhutlaReports()).toHaveLength(14);
    for (const report of karhutlaReports()) {
      expect(seedCodes).toContain(report.code);
      if (report.awalTitik !== null && report.padamTitik !== null && report.prosesTitik !== null) {
        expect(report.padamTitik + report.prosesTitik).toBe(report.awalTitik);
        expect(report.padamHa + report.prosesHa).toBeCloseTo(report.awalHa, 2);
      }
    }
    expect(karhutlaReport("XXI/RI")).toMatchObject({ padamTitik: 0, padamHa: 33, prosesHa: 21 });
    expect(karhutlaReport("XII/TPR")).toMatchObject({
      awalTitik: null,
      awalHa: 30.5,
      padamHa: 30.5,
      prosesTitik: 0,
      prosesHa: 0,
      personelSiaga: 5400,
    });
    expect(formatKarhutlaAmount(null, 30.5)).toBe("30,5 Ha");
    expect(formatKarhutlaAmount(0, 0)).toBe("0");
    expect(karhutlaReport("IM")).toBeNull();
    expect(karhutlaReport("JAYA")).toBeNull();
    expect(karhutlaReport("KODAERAL V")).toBeNull();
  });
});
