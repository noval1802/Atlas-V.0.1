import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { kotamaopsFeatures, kotamaopsIconId, safeKotamaopsLogo, type KotamaopsPoint } from "./kotamaops-points";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
/** Baris seed: [kode, nama, wilayah, lokasi, lintang, bujur, status, personel, dikerahkan, kejadian, matra]. */
const seedRows = [...readFileSync(path.join(root, "prisma/seed.mjs"), "utf8").matchAll(/^ {2}\["([^"]+)", [^\n]*?, (-?[\d.]+), (-?[\d.]+), "[A-Z]+", [^\n]*"(AD|AL|AU)"\],$/gm)].map(
  ([, code, lat, lng, matra]) => ({ code, lat: Number(lat), lng: Number(lng), matra }),
);

const point = (code: string, matra: KotamaopsPoint["matra"], logo = ""): KotamaopsPoint => ({
  code,
  name: code,
  region: "R",
  location: "L",
  lat: -6.2,
  lng: 106.82,
  matra,
  logo,
});

describe("kotamaops seed", () => {
  it("seeds the 22 headquarters inside Indonesia, Kodaeral V under TNI AL", () => {
    expect(seedRows).toHaveLength(22);
    expect(new Set(seedRows.map((row) => row.code)).size).toBe(22);
    for (const row of seedRows) {
      expect(row.lat).toBeGreaterThanOrEqual(-12);
      expect(row.lat).toBeLessThanOrEqual(7);
      expect(row.lng).toBeGreaterThanOrEqual(94);
      expect(row.lng).toBeLessThanOrEqual(142);
    }
    expect(seedRows.find((row) => row.code === "KODAERAL V")?.matra).toBe("AL");
    expect(seedRows.filter((row) => row.matra === "AD")).toHaveLength(21);
  });

  it("has a crest file for every seeded unit", () => {
    for (const row of seedRows) {
      const logo = `/kodam/${kotamaopsIconId(row.code).replace(/^kotamaops-/, "")}.png`;
      expect(existsSync(path.join(root, "public", logo.slice(1)))).toBe(true);
    }
  });
});

describe("kotamaopsFeatures", () => {
  it("draws only the matra whose layer is on", () => {
    const points = [point("JAYA", "AD", "/kodam/jaya.png"), point("KODAERAL V", "AL", "/kodam/kodaeral-v.png"), point("KOOPSUD I", "AU")];
    expect(kotamaopsFeatures(points, () => false)).toEqual([]);
    const al = kotamaopsFeatures(points, (matra) => matra === "AL");
    expect(al).toHaveLength(1);
    expect(al[0]).toMatchObject({
      geometry: { type: "Point", coordinates: [106.82, -6.2] },
      properties: { code: "KODAERAL V", matra: "AL", icon: "kotamaops-kodaeral-v", logo: "/kodam/kodaeral-v.png" },
    });
    expect(kotamaopsFeatures(points, () => true).find((f) => f.properties.code === "KOOPSUD I")?.properties.icon).toBe("kotamaops-shield");
  });

  it("refuses crest paths outside /kodam/", () => {
    expect(safeKotamaopsLogo("/kodam/i-bb.png")).toBe("/kodam/i-bb.png");
    expect(safeKotamaopsLogo("https://evil.example/x.png")).toBe("");
    expect(safeKotamaopsLogo('/kodam/x.png" onerror="alert(1)')).toBe("");
    expect(kotamaopsFeatures([point("X", "AD", "javascript:alert(1)")], () => true)[0].properties.icon).toBe("kotamaops-shield");
  });
});
