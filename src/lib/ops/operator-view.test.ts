import { describe, expect, it } from "vitest";
import {
  filterSituations,
  karhutlaScope,
  pageWindow,
  situationTotals,
  sortSituations,
  type SituationView,
} from "./operator-view";

function row(patch: Partial<SituationView> & Pick<SituationView, "id" | "code" | "status">): SituationView {
  return {
    name: patch.code,
    region: "Jawa",
    location: "Markas",
    personnel: 10,
    deployed: 2,
    incidentCount: 1,
    updatedAt: "2026-10-17T08:00:00.000Z",
    ...patch,
  };
}

describe("operator view", () => {
  const rows = [
    row({ id: "a", code: "JAYA", status: "SIAGA", incidentCount: 3, deployed: 4, updatedAt: "2026-10-17T10:00:00.000Z", location: "Jakarta" }),
    row({ id: "b", code: "XXII/TB", status: "WASPADA", incidentCount: 1, deployed: 1, updatedAt: "2026-10-17T09:00:00.000Z", location: "Bandung" }),
    row({ id: "a", code: "JAYA", status: "SIAGA", incidentCount: 3, deployed: 4, updatedAt: "2026-10-17T10:00:00.000Z", location: "Jakarta" }),
    row({ id: "c", code: "IM", status: "KONDUSIF", incidentCount: 0, deployed: 0, updatedAt: "2026-10-16T09:00:00.000Z", location: "Banda Aceh" }),
  ];

  it("counts each situation id once", () => {
    expect(situationTotals(rows)).toMatchObject({
      units: 3,
      siaga: 1,
      waspada: 1,
      kondusif: 1,
      incidentStored: 4,
      deployed: 5,
      latestUpdate: "2026-10-17T10:00:00.000Z",
    });
  });

  it("limits the frozen karhutla lapsit to the caller's unit codes", () => {
    expect(karhutlaScope(["XXII/TB", "IM"])).toMatchObject({
      at: "5 Okt 2026, 22.00",
      unitsOnReport: 1,
      dalamPemadaman: 1,
    });
    expect(karhutlaScope(["IM"])).toMatchObject({ unitsOnReport: 0, dalamPemadaman: 0 });
  });

  it("filters by status and location without inventing a category", () => {
    expect(filterSituations(rows, "jakarta", "SEMUA").map((item) => item.code)).toEqual(["JAYA"]);
    expect(filterSituations(rows, "", "WASPADA").map((item) => item.code)).toEqual(["XXII/TB"]);
    expect(filterSituations(rows, "tidak-ada", "SIAGA")).toEqual([]);
  });

  it("sorts by stored time and clamps the page", () => {
    expect(sortSituations(filterSituations(rows, "", "SEMUA"), "baru").map((item) => item.code)).toEqual(["JAYA", "XXII/TB", "IM"]);
    expect(sortSituations(filterSituations(rows, "", "SEMUA"), "lama").map((item) => item.code)).toEqual(["IM", "XXII/TB", "JAYA"]);
    const windowed = pageWindow(sortSituations(filterSituations(rows, "", "SEMUA"), "baru"), 9, 2);
    expect(windowed.page).toBe(2);
    expect(windowed.pages).toBe(2);
    expect(windowed.items.map((item) => item.code)).toEqual(["IM"]);
  });
});
