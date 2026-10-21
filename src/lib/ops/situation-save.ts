export type SavedSituation = {
  id: string;
  code: string;
  name: string;
  region: string;
  location: string;
  status: "KONDUSIF" | "WASPADA" | "SIAGA";
  personnel: number;
  deployed: number;
  incidentCount: number;
  note: string;
  updatedByName: string;
  updatedAt: string;
};

export type SituationSaveBody = {
  status: FormDataEntryValue | null;
  personnel: FormDataEntryValue | null;
  deployed: FormDataEntryValue | null;
  incidentCount: FormDataEntryValue | null;
  note: FormDataEntryValue | null;
};

export type SituationSaveResult =
  | { status: "saved"; data: SavedSituation }
  | { status: "rejected"; error: string }
  | { status: "failed"; error: string }
  | { status: "ignored" };

/** One in-flight save per row. A finished PATCH still creates its own revision. */
export function claimSave(lock: Set<string>, id: string): boolean {
  if (lock.has(id)) return false;
  lock.add(id);
  return true;
}

export function releaseSave(lock: Set<string>, id: string): void {
  lock.delete(id);
}

export async function saveSituationOnce(
  lock: Set<string>,
  id: string,
  body: SituationSaveBody,
  fetchImpl: typeof fetch = fetch,
  onStart?: () => void,
): Promise<SituationSaveResult> {
  if (!claimSave(lock, id)) return { status: "ignored" };
  try {
    onStart?.();
    const response = await fetchImpl(`/api/ops/situations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { status: "rejected", error: typeof data.error === "string" ? data.error : "Simpan gagal." };
    }
    return { status: "saved", data: data as SavedSituation };
  } catch {
    return { status: "failed", error: "Simpan gagal." };
  } finally {
    releaseSave(lock, id);
  }
}
