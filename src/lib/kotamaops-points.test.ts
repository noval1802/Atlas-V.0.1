import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { KOTAMAOPS_LOGOS, KOTAMAOPS_POINTS, kotamaopsFeatures, kotamaopsIconId, kotamaopsLogo } from "./kotamaops-points";

describe("kotamaops points", () => {
  it("lists the 22 ATLAS headquarters inside Indonesia", () => {
    expect(KOTAMAOPS_POINTS).toHaveLength(22);
    const codes = KOTAMAOPS_POINTS.map((point) => point.code);
    expect(new Set(codes).size).toBe(22);
    expect(codes).toEqual(expect.arrayContaining(["JAYA", "KODAERAL V", "XII/TPR"]));
    for (const point of KOTAMAOPS_POINTS) {
      expect(point.lat).toBeGreaterThanOrEqual(-12);
      expect(point.lat).toBeLessThanOrEqual(7);
      expect(point.lng).toBeGreaterThanOrEqual(94);
      expect(point.lng).toBeLessThanOrEqual(142);
      expect(point.name.length).toBeGreaterThan(0);
      expect(point.location.length).toBeGreaterThan(0);
    }
  });

  it("keeps the stored ATLAS coordinates for Kodam Jaya and Kodaeral V", () => {
    expect(KOTAMAOPS_POINTS.find((point) => point.code === "JAYA")).toMatchObject({
      location: "Jakarta",
      lat: -6.2,
      lng: 106.82,
    });
    expect(KOTAMAOPS_POINTS.find((point) => point.code === "KODAERAL V")).toMatchObject({
      location: "Surabaya",
      lat: -7.213222,
      lng: 112.724934,
    });
  });

  it("draws a point only while TNI AD is on", () => {
    expect(kotamaopsFeatures(false)).toEqual([]);
    const features = kotamaopsFeatures(true);
    expect(features).toHaveLength(22);
    expect(features[0]).toMatchObject({
      type: "Feature",
      geometry: { type: "Point", coordinates: [106.82, -6.2] },
      properties: { code: "JAYA", name: "Kodam Jaya", icon: "kotamaops-jaya", logo: "/kodam/jaya.png" },
    });
  });

  it("points every unit at its own crest file", () => {
    const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../public");
    const codes = KOTAMAOPS_POINTS.map((point) => point.code).sort();
    expect(Object.keys(KOTAMAOPS_LOGOS).sort()).toEqual(codes);
    expect(kotamaopsIconId("I/BB")).toBe("kotamaops-i-bb");
    expect(kotamaopsIconId("KODAERAL V")).toBe("kotamaops-kodaeral-v");
    for (const point of KOTAMAOPS_POINTS) {
      const logo = kotamaopsLogo(point.code);
      expect(logo).toMatch(/^\/kodam\/[a-z0-9-]+\.png$/);
      expect(existsSync(path.join(publicDir, logo.slice(1)))).toBe(true);
      const feature = kotamaopsFeatures(true).find((item) => item.properties.code === point.code);
      expect(feature?.properties.icon).toBe(kotamaopsIconId(point.code));
      expect(feature?.properties.logo).toBe(logo);
    }
  });
});
