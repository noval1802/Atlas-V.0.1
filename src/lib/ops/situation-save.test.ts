import { describe, expect, it, vi } from "vitest";
import { claimSave, releaseSave, saveSituationOnce, type SituationSaveBody } from "./situation-save";

const body: SituationSaveBody = {
  status: "KONDUSIF",
  personnel: "10",
  deployed: "2",
  incidentCount: "0",
  note: "uji",
};

const saved = {
  id: "row-1",
  code: "UJI",
  name: "Uji",
  region: "Uji",
  location: "Uji",
  status: "KONDUSIF",
  personnel: 10,
  deployed: 2,
  incidentCount: 0,
  note: "uji",
  updatedByName: "Penguji",
  updatedAt: "2026-10-16T00:00:00.000Z",
};

function jsonResponse(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("situation save lock", () => {
  it("lets the first claim through and blocks the same row until release", () => {
    const lock = new Set<string>();
    expect(claimSave(lock, "row-1")).toBe(true);
    expect(claimSave(lock, "row-1")).toBe(false);
    expect(claimSave(lock, "row-2")).toBe(true);
    releaseSave(lock, "row-1");
    expect(claimSave(lock, "row-1")).toBe(true);
  });

  it("sends one PATCH when the same row is submitted twice before the response", async () => {
    const lock = new Set<string>();
    let calls = 0;
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      await gate;
      return jsonResponse(200, saved);
    });
    const first = saveSituationOnce(lock, "row-1", body, fetchImpl);
    const second = await saveSituationOnce(lock, "row-1", { ...body, note: "lain" }, fetchImpl);
    expect(second).toEqual({ status: "ignored" });
    expect(calls).toBe(1);
    release?.();
    await expect(first).resolves.toMatchObject({ status: "saved", data: { code: "UJI" } });
    expect(calls).toBe(1);
    expect(lock.size).toBe(0);
  });

  it("allows a new save after the first one finishes", async () => {
    const lock = new Set<string>();
    const fetchImpl = vi.fn(async () => jsonResponse(200, saved));
    await saveSituationOnce(lock, "row-1", body, fetchImpl);
    const again = await saveSituationOnce(lock, "row-1", { ...body, note: "berikut" }, fetchImpl);
    expect(again.status).toBe("saved");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(lock.size).toBe(0);
  });

  it("sends one rejected PATCH for two overlapping invalid submits", async () => {
    const lock = new Set<string>();
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fetchImpl = vi.fn(async () => {
      await gate;
      return jsonResponse(400, { error: "Personel dikerahkan tidak boleh melebihi jumlah personel." });
    });
    const first = saveSituationOnce(lock, "row-1", body, fetchImpl);
    const second = await saveSituationOnce(lock, "row-1", body, fetchImpl);
    expect(second).toEqual({ status: "ignored" });
    release?.();
    await expect(first).resolves.toEqual({
      status: "rejected",
      error: "Personel dikerahkan tidak boleh melebihi jumlah personel.",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(lock.size).toBe(0);
  });

  it("releases the lock when the network fails so the next try can run", async () => {
    const lock = new Set<string>();
    const failing = vi.fn(async () => {
      throw new Error("offline");
    });
    const failed = await saveSituationOnce(lock, "row-1", body, failing);
    expect(failed).toEqual({ status: "failed", error: "Simpan gagal." });
    expect(lock.size).toBe(0);
    const fetchImpl = vi.fn(async () => jsonResponse(200, saved));
    const retried = await saveSituationOnce(lock, "row-1", body, fetchImpl);
    expect(retried.status).toBe("saved");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("does not report success for a server failure", async () => {
    const lock = new Set<string>();
    const fetchImpl = vi.fn(async () => jsonResponse(500, { error: "Simpan gagal." }));
    const result = await saveSituationOnce(lock, "row-1", body, fetchImpl);
    expect(result).toEqual({ status: "rejected", error: "Simpan gagal." });
    expect(lock.size).toBe(0);
  });
});
