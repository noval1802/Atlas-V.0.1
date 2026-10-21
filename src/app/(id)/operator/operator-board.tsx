"use client";

import { FormEvent, useRef, useState } from "react";
import { portalLabel } from "@/lib/ops/access";
import { saveSituationOnce } from "@/lib/ops/situation-save";

export type SituationRow = {
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

const statuses = ["KONDUSIF", "WASPADA", "SIAGA"] as const;

function stamp(value: string) {
  return new Date(value).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" });
}

export function OperatorBoard({
  me,
  initial,
  canWrite,
  showChrome = true,
  onSaved,
}: {
  me: { name: string; role: string; kotamaops: { code: string; name: string } | null };
  initial: SituationRow[];
  canWrite: boolean;
  showChrome?: boolean;
  onSaved?: (row: SituationRow) => void;
}) {
  const [rows, setRows] = useState(initial);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busyId, setBusyId] = useState("");
  const saving = useRef(new Set<string>());

  async function save(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const outcome = await saveSituationOnce(
        saving.current,
        id,
        {
          status: form.get("status"),
          personnel: form.get("personnel"),
          deployed: form.get("deployed"),
          incidentCount: form.get("incidentCount"),
          note: form.get("note"),
        },
        fetch,
        () => {
          setError("");
          setInfo("");
          setBusyId(id);
        },
      );
      if (outcome.status === "ignored") return;
      if (outcome.status === "saved") {
        setRows((current) => current.map((row) => (row.id === id ? outcome.data : row)));
        onSaved?.(outcome.data);
        setInfo(`${outcome.data.code} diperbarui.`);
        return;
      }
      setError(outcome.error);
    } catch {
      setError("Simpan gagal.");
    } finally {
      if (!saving.current.has(id)) setBusyId((current) => (current === id ? "" : current));
    }
  }

  async function logout() {
    await fetch("/api/ops/logout", { method: "POST" });
    window.location.assign("/masuk");
  }

  const siaga = rows.filter((row) => row.status === "SIAGA").length;
  const waspada = rows.filter((row) => row.status === "WASPADA").length;

  return (
    <div className="space-y-4">
      {showChrome && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div>
              <p className="text-sm">{me.name}</p>
              <p className="text-xs text-white/50">
                {portalLabel(me.role)} ({me.role})
                {me.kotamaops ? ` · ${me.kotamaops.code}` : " · seluruh Kotamaops"}
              </p>
            </div>
            <button type="button" onClick={logout} className="rounded border border-white/15 px-3 py-2 text-xs font-bold">
              KELUAR
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              ["Satuan", rows.length],
              ["Waspada", waspada],
              ["Siaga", siaga],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-xl border border-white/10 p-3">
                <p className="text-[10px] tracking-wider text-white/55">{label}</p>
                <p className="text-2xl font-semibold text-[var(--gold-primary)]">{value}</p>
              </div>
            ))}
          </div>
        </>
      )}
      <p role="status" aria-atomic="true" className="sr-only">{info}</p>
      <p role="alert" aria-atomic="true" className="sr-only">{error}</p>
      {error && <p className="text-sm text-[var(--gold-primary)]">{error}</p>}
      {info && <p className="text-sm text-[var(--gold-primary)]">{info}</p>}
      {!canWrite && <p className="text-sm text-white/60">Peran ini membaca situasi terkini dan tidak menyimpan perubahan.</p>}
      {rows.length === 0 && <p className="text-sm text-white/60">Tidak ada Kotamaops pada cakupan akun ini.</p>}
      <div className="space-y-3">
        {rows.map((row) => (
          <form id={`satuan-${row.id}`} key={row.id} onSubmit={(event) => save(event, row.id)} className="scroll-mt-24 rounded-xl border border-white/10 p-4">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold">
                  {row.code} · {row.name}
                </h2>
                <p className="text-xs text-white/50">
                  {row.region} · {row.location}
                </p>
              </div>
              <p className="text-[11px] text-white/55">
                {row.updatedByName ? `${row.updatedByName} · ` : ""}
                {stamp(row.updatedAt)} WIB
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <label className="text-xs">
                Status
                <select
                  name="status"
                  defaultValue={row.status}
                  disabled={!canWrite}
                  className="mt-1 w-full rounded border border-[var(--control-border)] bg-black/40 px-2 py-2"
                >
                  {statuses.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs">
                Personel
                <input
                  name="personnel"
                  type="number"
                  min={0}
                  defaultValue={row.personnel}
                  disabled={!canWrite}
                  className="mt-1 w-full rounded border border-[var(--control-border)] bg-black/40 px-2 py-2"
                />
              </label>
              <label className="text-xs">
                Dikerahkan
                <input
                  name="deployed"
                  type="number"
                  min={0}
                  defaultValue={row.deployed}
                  disabled={!canWrite}
                  className="mt-1 w-full rounded border border-[var(--control-border)] bg-black/40 px-2 py-2"
                />
              </label>
              <label className="text-xs">
                Kejadian
                <input
                  name="incidentCount"
                  type="number"
                  min={0}
                  defaultValue={row.incidentCount}
                  disabled={!canWrite}
                  className="mt-1 w-full rounded border border-[var(--control-border)] bg-black/40 px-2 py-2"
                />
              </label>
            </div>
            <label className="mt-3 block text-xs">
              Catatan situasi terkini
              <textarea
                name="note"
                defaultValue={row.note}
                disabled={!canWrite}
                rows={2}
                className="mt-1 w-full rounded border border-[var(--control-border)] bg-black/40 px-2 py-2"
              />
            </label>
            {canWrite && (
              <button
                type="submit"
                disabled={busyId === row.id}
                className="mt-3 rounded bg-[var(--gold-primary)] px-3 py-2 text-xs font-bold text-black disabled:opacity-60"
              >
                {busyId === row.id ? "Menyimpan..." : "Simpan data terkini"}
              </button>
            )}
          </form>
        ))}
      </div>
    </div>
  );
}
