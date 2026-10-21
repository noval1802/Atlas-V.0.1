import { KARHUTLA_LAPSIT_AT, karhutlaReports } from "@/lib/karhutla-lapsit";

export const SITUATION_STATUSES = ["KONDUSIF", "WASPADA", "SIAGA"] as const;
export type SituationStatus = (typeof SITUATION_STATUSES)[number];

/** One stored situation row. Incident totals are this table only, one row per unit. */
export type SituationView = {
  id: string;
  code: string;
  name: string;
  region: string;
  location: string;
  status: SituationStatus;
  personnel: number;
  deployed: number;
  incidentCount: number;
  updatedAt: string;
};

export type SituationTotals = {
  units: number;
  kondusif: number;
  waspada: number;
  siaga: number;
  incidentStored: number;
  deployed: number;
  latestUpdate: string | null;
};

export type KarhutlaScope = {
  at: string;
  unitsOnReport: number;
  dalamPemadaman: number;
};

function uniqueRows(rows: readonly SituationView[]): SituationView[] {
  const byId = new Map<string, SituationView>();
  for (const row of rows) byId.set(row.id, row);
  return [...byId.values()];
}

export function situationTotals(rows: readonly SituationView[]): SituationTotals {
  const unique = uniqueRows(rows);
  let kondusif = 0;
  let waspada = 0;
  let siaga = 0;
  let incidentStored = 0;
  let deployed = 0;
  let latestUpdate: string | null = null;
  for (const row of unique) {
    if (row.status === "KONDUSIF") kondusif += 1;
    else if (row.status === "WASPADA") waspada += 1;
    else siaga += 1;
    incidentStored += row.incidentCount;
    deployed += row.deployed;
    if (!latestUpdate || row.updatedAt > latestUpdate) latestUpdate = row.updatedAt;
  }
  return { units: unique.length, kondusif, waspada, siaga, incidentStored, deployed, latestUpdate };
}

/** Frozen 5 Oct 2026 lapsit, limited to unit codes the caller can already see. */
export function karhutlaScope(codes: readonly string[]): KarhutlaScope {
  const allowed = new Set(codes);
  const reports = karhutlaReports().filter((item) => allowed.has(item.code));
  const dalamPemadaman = reports.filter((item) => (item.prosesTitik ?? 0) > 0 || item.prosesHa > 0).length;
  return { at: KARHUTLA_LAPSIT_AT, unitsOnReport: reports.length, dalamPemadaman };
}

export function filterSituations(
  rows: readonly SituationView[],
  query: string,
  status: SituationStatus | "SEMUA",
): SituationView[] {
  const needle = query.trim().toLowerCase();
  return uniqueRows(rows).filter((row) => {
    if (status !== "SEMUA" && row.status !== status) return false;
    if (!needle) return true;
    return [row.code, row.name, row.region, row.location].some((part) => part.toLowerCase().includes(needle));
  });
}

export function sortSituations(rows: readonly SituationView[], direction: "baru" | "lama"): SituationView[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    const byTime = a.updatedAt < b.updatedAt ? -1 : a.updatedAt > b.updatedAt ? 1 : 0;
    const order = byTime === 0 ? a.code.localeCompare(b.code, "id") : byTime;
    return direction === "baru" ? -order : order;
  });
  return copy;
}

export function pageWindow<T>(rows: readonly T[], page: number, size: number) {
  const safeSize = Math.max(1, size);
  const pages = Math.max(1, Math.ceil(rows.length / safeSize));
  const current = Math.min(Math.max(1, page), pages);
  const start = (current - 1) * safeSize;
  return { page: current, pages, total: rows.length, items: rows.slice(start, start + safeSize) };
}

export function formatWib(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Waktu tidak valid";
  return `${date.toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" })} WIB`;
}
