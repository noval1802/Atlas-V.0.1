"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import type { SituationRow } from "@/app/(id)/operator/operator-board";
import { safeKotamaopsLogo } from "@/lib/kotamaops-points";
import type { UnitView } from "@/lib/ops/kotamaops-admin";

const control =
  "mt-1 block min-h-11 w-full rounded border border-[var(--control-border)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-heading)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold-primary)]";
const label = "text-sm text-[var(--text-secondary)]";
const button =
  "min-h-11 rounded border px-3 py-2 text-sm disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold-primary)]";

type Saved = { unit: UnitView; row: SituationRow | null };

export function KotamaopsManager({
  canDelete,
  onAdded,
  onUpdated,
  onRemoved,
}: {
  canDelete: boolean;
  onAdded: (row: SituationRow) => void;
  onUpdated: (row: SituationRow) => void;
  onRemoved: (situationId: string) => void;
}) {
  const [units, setUnits] = useState<UnitView[] | null>(null);
  const [editing, setEditing] = useState<UnitView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/ops/kotamaops", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json().catch(() => null);
        if (!live) return;
        if (!response.ok) setError(body?.error ?? "Daftar Kotamaops gagal dimuat.");
        else setUnits(body.units);
      })
      .catch(() => live && setError("Tidak dapat menghubungi server."));
    return () => {
      live = false;
    };
  }, []);

  function startEdit(unit: UnitView | null) {
    setEditing(unit);
    setError("");
    setInfo("");
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setError("");
    setInfo("");
    try {
      const response = await fetch(editing ? `/api/ops/kotamaops/${editing.id}` : "/api/ops/kotamaops", {
        method: editing ? "PATCH" : "POST",
        body: new FormData(form),
      });
      const body = (await response.json().catch(() => null)) as (Saved & { error?: string }) | null;
      if (!response.ok || !body?.unit) {
        setError(body?.error ?? "Kotamaops gagal disimpan.");
        return;
      }
      const { unit, row } = body;
      if (editing) {
        setUnits((current) => current?.map((item) => (item.id === unit.id ? unit : item)) ?? null);
        if (row) onUpdated(row);
        setInfo(`${unit.code} · ${unit.name} diperbarui.`);
      } else {
        setUnits((current) => [...(current ?? []), unit]);
        if (row) onAdded(row);
        setInfo(`${unit.code} · ${unit.name} ditambahkan dengan status awal KONDUSIF dan catatan "Belum ada laporan."`);
      }
      setEditing(null);
      form.reset();
    } catch {
      setError("Tidak dapat menghubungi server. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(unit: UnitView) {
    const sure = window.confirm(
      `Hapus ${unit.code} · ${unit.name}?\n\nSituasi dan seluruh riwayat simpanan satuan ini ikut terhapus dan tidak dapat dikembalikan.`,
    );
    if (!sure) return;
    setBusy(true);
    setError("");
    setInfo("");
    try {
      const response = await fetch(`/api/ops/kotamaops/${unit.id}`, { method: "DELETE" });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(body?.error ?? "Kotamaops gagal dihapus.");
        return;
      }
      setUnits((current) => current?.filter((item) => item.id !== unit.id) ?? null);
      if (body?.situationId) onRemoved(body.situationId);
      if (editing?.id === unit.id) setEditing(null);
      setInfo(`${unit.code} · ${unit.name} dihapus.`);
    } catch {
      setError("Tidak dapat menghubungi server. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {units === null && !error && <p className="text-sm text-[var(--text-secondary)]">Memuat daftar Kotamaops.</p>}
      {units && (
        <ul className="max-h-72 divide-y divide-[var(--border-secondary)] overflow-y-auto pr-1 text-sm">
          {units.map((unit) => (
            <li key={unit.id} className="flex flex-wrap items-center gap-3 py-2">
              <Crest logo={unit.logo} />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-[var(--text-heading)]">
                  {unit.code} <span className="font-normal text-[var(--text-secondary)]">· {unit.matra}</span>
                </p>
                <p className="truncate text-[var(--text-secondary)]">
                  {unit.name} · {unit.location}, {unit.region}
                </p>
              </div>
              <button type="button" disabled={busy} onClick={() => startEdit(unit)} className={`${button} border-[var(--control-border)] text-[var(--text-heading)]`}>
                Edit
              </button>
              {canDelete && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void remove(unit)}
                  title={unit.boundUsers > 0 ? `${unit.boundUsers} akun masih terikat ke satuan ini` : undefined}
                  className={`${button} border-[var(--alert-red)] text-[var(--alert-red)]`}
                >
                  Hapus
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div ref={formRef} className="scroll-mt-24 space-y-3 border-t border-[var(--border-secondary)] pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[var(--text-heading)]">{editing ? `Edit ${editing.code}` : "Tambah Kotamaops baru"}</h3>
          {editing && (
            <button type="button" onClick={() => startEdit(null)} className={`${button} border-[var(--control-border)] text-[var(--text-secondary)]`}>
              Batal edit
            </button>
          )}
        </div>
        {/* key: a fresh form per unit, so defaultValue picks up the unit being edited. */}
        <form key={editing?.id ?? "baru"} onSubmit={submit} className="grid gap-3 sm:grid-cols-2" aria-describedby="kotamaops-catatan">
          <label className={label}>
            Kode
            <input name="code" required maxLength={24} defaultValue={editing?.code} placeholder="XXV/CON" autoCapitalize="characters" className={control} />
          </label>
          <label className={label}>
            Nama
            <input name="name" required minLength={2} maxLength={120} defaultValue={editing?.name} placeholder="Kodam XXV/Contoh" className={control} />
          </label>
          <label className={label}>
            Matra
            <select name="matra" defaultValue={editing?.matra ?? "AD"} className={control}>
              <option value="AD">AD (Kodam)</option>
              <option value="AL">AL (Kodaeral)</option>
              <option value="AU">AU (Kodau)</option>
            </select>
          </label>
          <label className={label}>
            Wilayah (provinsi)
            <input name="region" required minLength={2} maxLength={120} defaultValue={editing?.region} placeholder="Papua Tengah" className={control} />
          </label>
          <label className={label}>
            Lokasi markas
            <input name="location" required minLength={2} maxLength={120} defaultValue={editing?.location} placeholder="Nabire" className={control} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className={label}>
              Lintang
              <input name="latitude" required inputMode="decimal" defaultValue={editing?.latitude} placeholder="-3.36" className={control} />
            </label>
            <label className={label}>
              Bujur
              <input name="longitude" required inputMode="decimal" defaultValue={editing?.longitude} placeholder="135.50" className={control} />
            </label>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <label className={label}>
              {editing?.logo ? "Ganti logo" : "Logo"} (PNG, JPG, atau WebP, maks 512 KB, sebaiknya persegi dengan latar transparan)
              <input name="logo" type="file" accept="image/png,image/jpeg,image/webp" className={`${control} file:mr-3 file:rounded file:border-0 file:bg-[var(--hover-accent)] file:px-3 file:py-1 file:text-[var(--text-heading)]`} />
            </label>
            {editing?.logo && (
              <label className="flex min-h-11 items-center gap-2 text-sm text-[var(--text-secondary)]">
                <Crest logo={editing.logo} />
                <input name="removeLogo" type="checkbox" value="1" className="h-4 w-4" />
                Hapus logo (pakai perisai bawaan)
              </label>
            )}
          </div>
          <p id="kotamaops-catatan" className="text-xs text-[var(--text-secondary)] sm:col-span-2">
            Koordinat markas dalam derajat desimal (lintang selatan negatif). Satuan baru tampil di peta dan dasbor dengan status awal KONDUSIF dan
            catatan &quot;Belum ada laporan.&quot; sampai operator memperbaruinya.
          </p>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <button type="submit" disabled={busy} className={`${button} border-[var(--gold-primary)] font-medium text-[var(--gold-primary)] hover:bg-[var(--hover-accent)]`}>
              {busy ? "Menyimpan…" : editing ? "Simpan perubahan" : "Tambah Kotamaops"}
            </button>
          </div>
        </form>
        <p role="status" className="text-sm text-[var(--text-heading)]">
          {info}
        </p>
        {error && (
          <p role="alert" className="text-sm text-[var(--alert-red)]">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

function Crest({ logo }: { logo: string }) {
  const src = safeKotamaopsLogo(logo);
  if (!src) {
    return (
      <span aria-hidden="true" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded border border-[var(--border-secondary)] text-xs text-[var(--text-secondary)]">
        —
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- next/image is off for this app (next.config.ts images.unoptimized)
  return <img src={src} alt="" className="h-9 w-9 shrink-0 object-contain" />;
}
