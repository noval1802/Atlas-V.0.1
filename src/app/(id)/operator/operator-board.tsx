"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
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
  const [selectedId, setSelectedId] = useState(initial[0]?.id ?? "");
  const formRef = useRef<HTMLDivElement>(null);
  const selected = rows.find((row) => row.id === selectedId) ?? rows[0];

  // Tautan "Perbarui" di tabel memakai #satuan-<id>; pilih satuan itu di formulir tunggal.
  useEffect(() => {
    const pick = () => {
      const id = window.location.hash.match(/^#satuan-(.+)$/)?.[1];
      if (!id || !initial.some((row) => row.id === id)) return;
      setSelectedId(id);
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    pick();
    window.addEventListener("hashchange", pick);
    return () => window.removeEventListener("hashchange", pick);
  }, [initial]);

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
      {(error || info) && (
        <p key={error || info} className={`ops-fade rounded border px-3 py-2 text-sm ${error ? "border-[var(--alert-red)] text-[var(--alert-red)]" : "border-[var(--gold-dim)] text-[var(--gold-primary)]"}`}>
          {error || info}
        </p>
      )}
      {!canWrite && <p className="text-sm text-[var(--text-secondary)]">Peran ini membaca situasi terkini dan tidak menyimpan perubahan.</p>}
      {rows.length === 0 && <p className="text-sm text-[var(--text-secondary)]">Tidak ada Kotamaops pada cakupan akun ini.</p>}
      {selected && (
        <div ref={formRef} className="scroll-mt-24 rounded-lg border border-[var(--border-secondary)] bg-[var(--bg-secondary)] p-4">
          <label className="mb-4 block border-b border-[var(--border-secondary)] pb-4 text-xs text-[var(--text-secondary)]">
            Kotamaops terdaftar ({rows.length.toLocaleString("id-ID")})
            <select
              value={selected.id}
              onChange={(event) => setSelectedId(event.target.value)}
              className="mt-1 w-full min-h-11 rounded border border-[var(--control-border)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-heading)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold-primary)]"
            >
              {rows.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} · {item.name} — {item.status}
                </option>
              ))}
            </select>
          </label>
        <form key={selected.id} onSubmit={(event) => save(event, selected.id)} className="ops-fade">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-[var(--text-heading)]">
                {selected.code} · {selected.name}
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                {selected.region} · {selected.location}
              </p>
            </div>
            <p className="text-[11px] tabular-nums text-[var(--text-secondary)]">
              {selected.updatedByName ? `${selected.updatedByName} · ` : ""}
              {stamp(selected.updatedAt)} WIB
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="text-xs text-[var(--text-secondary)]">
              Status
              <select
                name="status"
                defaultValue={selected.status}
                disabled={!canWrite}
                className="mt-1 w-full min-h-11 rounded border border-[var(--control-border)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-heading)] disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold-primary)]"
              >
                {statuses.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-[var(--text-secondary)]">
              Personel
              <input
                name="personnel"
                type="number"
                min={0}
                defaultValue={selected.personnel}
                disabled={!canWrite}
                className="mt-1 w-full min-h-11 rounded border border-[var(--control-border)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-heading)] disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold-primary)]"
              />
            </label>
            <label className="text-xs text-[var(--text-secondary)]">
              Dikerahkan
              <input
                name="deployed"
                type="number"
                min={0}
                defaultValue={selected.deployed}
                disabled={!canWrite}
                className="mt-1 w-full min-h-11 rounded border border-[var(--control-border)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-heading)] disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold-primary)]"
              />
            </label>
            <label className="text-xs text-[var(--text-secondary)]">
              Kejadian
              <input
                name="incidentCount"
                type="number"
                min={0}
                defaultValue={selected.incidentCount}
                disabled={!canWrite}
                className="mt-1 w-full min-h-11 rounded border border-[var(--control-border)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-heading)] disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold-primary)]"
              />
            </label>
          </div>
          <label className="mt-3 block text-xs text-[var(--text-secondary)]">
            Catatan situasi terkini
            <textarea
              name="note"
              defaultValue={selected.note}
              disabled={!canWrite}
              rows={2}
              className="mt-1 w-full min-h-11 rounded border border-[var(--control-border)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-heading)] disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold-primary)]"
            />
          </label>
          {canWrite && (
            <button
              type="submit"
              disabled={busyId === selected.id}
              className="mt-3 min-h-11 rounded bg-[var(--gold-primary)] px-4 py-2 text-xs font-bold text-black disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold-primary)]"
            >
              {busyId === selected.id ? "Menyimpan..." : "Simpan data terkini"}
            </button>
          )}
        </form>
        </div>
      )}
    </div>
  );
}
