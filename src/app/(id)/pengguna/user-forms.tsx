"use client";

import { useState, type FormEvent } from "react";
import { Info, UserPlus } from "lucide-react";
import { draftFrom, riskyChanges, roleChoices, STATUS_LABEL, stamp, type Unit, type UserDraft, type UserRow } from "./user-board-logic";
import { fieldClass, labelClass, Modal, PasswordInput } from "./user-ui";

function KotamaopsSelect({ value, role, kotamaops, onChange }: { value: string | null; role: string; kotamaops: Unit[]; onChange: (value: string | null) => void }) {
  const needed = role === "OPERATOR_KODAM";
  return (
    <label className={labelClass}>
      Kotamaops
      <select name="kotamaopsId" value={needed ? (value ?? "") : ""} disabled={!needed} onChange={(event) => onChange(event.target.value || null)} className={fieldClass}>
        <option value="">{needed ? "Pilih Kotamaops" : "Tanpa Kotamaops"}</option>
        {kotamaops.map((unit) => (
          <option key={unit.id} value={unit.id}>
            {unit.code} · {unit.name}
          </option>
        ))}
      </select>
      <span className="text-xs font-normal text-[var(--text-muted)]">Wajib diisi untuk peran OPERATOR_KODAM.</span>
    </label>
  );
}

function RoleSelect({ actorRole, current, value, onChange }: { actorRole: string; current?: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className={labelClass}>
      Peran
      <select name="role" value={value} onChange={(event) => onChange(event.target.value)} className={fieldClass}>
        {roleChoices(actorRole, current).map(([role, label]) => (
          <option key={role} value={role}>
            {role} · {label}
          </option>
        ))}
      </select>
    </label>
  );
}

function FormError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-md border-l-[3px] border-rose-400 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
      {message}
    </p>
  );
}

/** Edit one account. Risky changes (role, password, activation) need a second, explicit step. */
export function EditUserDialog({
  row,
  actorRole,
  kotamaops,
  onClose,
  onSave,
}: {
  row: UserRow;
  actorRole: string;
  kotamaops: Unit[];
  onClose: () => void;
  onSave: (draft: UserDraft) => Promise<string | null>;
}) {
  const [draft, setDraft] = useState<UserDraft>(() => draftFrom(row));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState<string[] | null>(null);
  const set = (patch: Partial<UserDraft>) => setDraft((current) => ({ ...current, ...patch }));

  async function commit() {
    setBusy(true);
    const failure = await onSave(draft);
    setBusy(false);
    if (failure) {
      setReview(null);
      setError(failure);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (draft.password && draft.password !== draft.confirmPassword) {
      setError("Konfirmasi kata sandi tidak sama.");
      return;
    }
    if (draft.role === "OPERATOR_KODAM" && !draft.kotamaopsId) {
      setError("Operator Kodam wajib diikat ke satu Kotamaops.");
      return;
    }
    const risky = riskyChanges(row, draft);
    if (risky.length) setReview(risky);
    else void commit();
  }

  return (
    <Modal title={`Ubah pengguna · ${row.username}`} onClose={busy ? () => {} : onClose} width="max-w-2xl">
      {review ? (
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">Periksa perubahan berikut sebelum disimpan:</p>
          <ul className="space-y-2 text-sm text-[var(--text-primary)]">
            {review.map((line) => (
              <li key={line} className="flex gap-2">
                <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--gold-primary)]" />
                {line}
              </li>
            ))}
          </ul>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setReview(null)} disabled={busy} className="h-10 rounded-md border border-white/20 px-4 text-sm font-semibold hover:bg-white/5 disabled:opacity-50">
              Kembali
            </button>
            <button type="button" onClick={() => void commit()} disabled={busy} className="h-10 rounded-md bg-[var(--gold-primary)] px-4 text-sm font-bold text-[#1a1404] hover:brightness-110 disabled:cursor-wait disabled:opacity-60">
              {busy ? "Menyimpan…" : "Ya, simpan perubahan"}
            </button>
          </div>
        </div>
      ) : (
        <form method="post" onSubmit={submit} className="grid gap-4">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-md border border-white/10 bg-black/20 p-3 text-xs">
            <dt className="text-[var(--text-muted)]">Email</dt>
            <dd className="truncate text-[var(--text-primary)]">{row.email ?? "—"}</dd>
            <dt className="text-[var(--text-muted)]">Satuan / jabatan</dt>
            <dd className="truncate text-[var(--text-primary)]">{[row.organization, row.position].filter(Boolean).join(" · ") || "—"}</dd>
            <dt className="text-[var(--text-muted)]">Status</dt>
            <dd className="text-[var(--text-primary)]">{STATUS_LABEL[row.accountStatus]}</dd>
            <dt className="text-[var(--text-muted)]">Dibuat</dt>
            <dd className="text-[var(--text-primary)]">{stamp(row.createdAt)} WIB</dd>
          </dl>
          <label className={labelClass}>
            Nama lengkap
            <input name="name" required value={draft.name} onChange={(event) => set({ name: event.target.value })} className={fieldClass} />
          </label>
          <div className="grid items-start gap-4 sm:grid-cols-2">
            <RoleSelect actorRole={actorRole} current={row.role} value={draft.role} onChange={(role) => set({ role })} />
            <KotamaopsSelect value={draft.kotamaopsId} role={draft.role} kotamaops={kotamaops} onChange={(kotamaopsId) => set({ kotamaopsId })} />
          </div>
          {row.accountStatus !== "PENDING" && (
            <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
              <input type="checkbox" checked={draft.active} onChange={(event) => set({ active: event.target.checked })} className="h-4 w-4 accent-[var(--gold-primary)]" />
              Akun aktif
            </label>
          )}
          <fieldset className="grid gap-3 rounded-md border border-white/10 p-3">
            <legend className="px-1 text-[13px] font-medium text-[var(--text-secondary)]">Kata sandi baru (kosongkan bila tetap)</legend>
            <PasswordInput name="password" label="Kata sandi baru" value={draft.password} onChange={(password) => set({ password })} placeholder="Minimal 12 karakter" />
            <PasswordInput name="confirmPassword" label="Ulangi kata sandi baru" value={draft.confirmPassword} onChange={(confirmPassword) => set({ confirmPassword })} placeholder="Ulangi kata sandi" />
          </fieldset>
          <FormError message={error} />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} disabled={busy} className="h-10 rounded-md border border-white/20 px-4 text-sm font-semibold hover:bg-white/5 disabled:opacity-50">
              Batal
            </button>
            <button type="submit" disabled={busy} className="h-10 rounded-md bg-[var(--gold-primary)] px-4 text-sm font-bold text-[#1a1404] hover:brightness-110 disabled:cursor-wait disabled:opacity-60">
              {busy ? "Menyimpan…" : "Simpan perubahan"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

const EMPTY = { name: "", username: "", password: "", confirmPassword: "", role: "ANALYST", kotamaopsId: null as string | null };

export function CreateUserForm({
  actorRole,
  kotamaops,
  onCreate,
}: {
  actorRole: string;
  kotamaops: Unit[];
  onCreate: (body: Record<string, unknown>) => Promise<string | null>;
}) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<typeof EMPTY>) => setForm((current) => ({ ...current, ...patch }));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    if (form.password !== form.confirmPassword) {
      setError("Konfirmasi kata sandi tidak sama.");
      return;
    }
    if (form.role === "OPERATOR_KODAM" && !form.kotamaopsId) {
      setError("Operator Kodam wajib diikat ke satu Kotamaops.");
      return;
    }
    setBusy(true);
    const failure = await onCreate({
      name: form.name,
      username: form.username,
      password: form.password,
      role: form.role,
      kotamaopsId: form.role === "OPERATOR_KODAM" ? form.kotamaopsId : null,
    });
    setBusy(false);
    if (failure) setError(failure);
    else setForm(EMPTY);
  }

  return (
    <form method="post" onSubmit={submit} className="grid gap-4 p-5" aria-labelledby="buat-pengguna">
      <h2 id="buat-pengguna" className="flex items-center gap-3 text-[17px] font-semibold text-[var(--text-heading)]">
        <UserPlus className="h-6 w-6 text-[var(--gold-primary)]" aria-hidden="true" />
        Buat pengguna baru
      </h2>
      <label className={labelClass}>
        Nama lengkap
        <input name="name" required minLength={2} maxLength={120} value={form.name} onChange={(event) => set({ name: event.target.value })} placeholder="Contoh: Andi Darmawan" className={fieldClass} />
      </label>
      <label className={labelClass}>
        Nama pengguna
        <input
          name="username"
          required
          autoCapitalize="none"
          spellCheck={false}
          value={form.username}
          onChange={(event) => set({ username: event.target.value.toLowerCase() })}
          placeholder="Contoh: andi.d"
          className={fieldClass}
        />
        <span className="text-xs font-normal text-[var(--text-muted)]">3–32 karakter: huruf kecil, angka, titik, garis bawah, atau strip.</span>
      </label>
      <label className={labelClass}>
        Kata sandi
        <PasswordInput name="password" label="Kata sandi" value={form.password} onChange={(password) => set({ password })} placeholder="Minimal 12 karakter" />
      </label>
      <label className={labelClass}>
        Konfirmasi kata sandi
        <PasswordInput name="confirmPassword" label="Konfirmasi kata sandi" value={form.confirmPassword} onChange={(confirmPassword) => set({ confirmPassword })} placeholder="Ulangi kata sandi" />
      </label>
      <RoleSelect actorRole={actorRole} value={form.role} onChange={(role) => set({ role })} />
      <KotamaopsSelect value={form.kotamaopsId} role={form.role} kotamaops={kotamaops} onChange={(kotamaopsId) => set({ kotamaopsId })} />
      <FormError message={error} />
      <button
        type="submit"
        disabled={busy}
        className="flex h-11 items-center justify-center gap-2 rounded-md bg-[linear-gradient(180deg,color-mix(in_srgb,var(--gold-primary)_75%,white),var(--gold-primary))] text-sm font-bold text-[#1a1404] shadow-[0_0_24px_-8px_rgba(var(--gold-rgb),0.7)] hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
      >
        <UserPlus className="h-4 w-4" aria-hidden="true" />
        {busy ? "Membuat…" : "Buat pengguna"}
      </button>
      <p className="flex gap-3 rounded-md border border-[rgba(var(--cyan-rgb),0.25)] bg-[rgba(var(--cyan-rgb),0.06)] p-3 text-xs leading-relaxed text-[var(--text-secondary)]">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cyan-primary)]" aria-hidden="true" />
        <span>
          Akun yang dibuat admin langsung <strong className="text-[var(--text-primary)]">aktif</strong> dan bisa masuk. Pendaftaran lewat halaman Daftar yang berstatus{" "}
          <strong className="text-[var(--cyan-primary)]">PENDING</strong> dan perlu disetujui di atas.
        </span>
      </p>
    </form>
  );
}
