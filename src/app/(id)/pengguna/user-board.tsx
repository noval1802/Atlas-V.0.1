"use client";

import { FormEvent, useState } from "react";

const roleOptions = [
  ["SUPER_ADMIN", "Admin bootstrap (SUPER_ADMIN)"],
  ["ADMIN", "Admin"],
  ["OPERATOR_PUSDALOPS", "Operator pusat"],
  ["OPERATOR_KODAM", "Operator Kotamaops"],
  ["ANALYST", "Viewer"],
  ["PIMPINAN", "Monitoring"],
] as const;

const statusLabel: Record<string, string> = {
  PENDING: "Menunggu",
  ACTIVE: "Aktif",
  REJECTED: "Ditolak",
  DISABLED: "Nonaktif",
};

const statusTone: Record<string, string> = {
  PENDING: "border-amber-300/40 text-amber-200",
  ACTIVE: "border-emerald-300/40 text-emerald-200",
  REJECTED: "border-rose-300/40 text-rose-200",
  DISABLED: "border-white/20 text-white/60",
};

const roleLabel: Record<string, string> = Object.fromEntries(roleOptions);

type Unit = { id: string; code: string; name: string };
type AccountStatus = "PENDING" | "ACTIVE" | "REJECTED" | "DISABLED";
export type UserRow = {
  id: string;
  name: string;
  username: string;
  email: string | null;
  organization: string;
  position: string;
  role: string;
  active: boolean;
  accountStatus: AccountStatus;
  kotamaopsId: string | null;
  kotamaops: Unit | null;
  lastLoginAt: string | null;
  createdAt: string;
};

function stamp(value: string) {
  return new Date(value).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" });
}

function roleChoices(actorRole: string, current?: string) {
  if (actorRole === "SUPER_ADMIN") return roleOptions;
  if (current === "SUPER_ADMIN") return roleOptions.filter(([role]) => role === "SUPER_ADMIN");
  return roleOptions.filter(([role]) => role !== "SUPER_ADMIN");
}

export function UserBoard({
  actorRole,
  initialUsers,
  kotamaops,
}: {
  actorRole: string;
  initialUsers: UserRow[];
  kotamaops: Unit[];
}) {
  const [users, setUsers] = useState(initialUsers);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [openId, setOpenId] = useState("");

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setError("");
    setInfo("");
    const form = new FormData(formElement);
    const response = await fetch("/api/ops/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        username: form.get("username"),
        password: form.get("password"),
        role: form.get("role"),
        kotamaopsId: form.get("kotamaopsId"),
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(typeof data.error === "string" ? data.error : "Pengguna gagal dibuat.");
      return;
    }
    setUsers((current) => [...current, data].sort((a, b) => a.username.localeCompare(b.username)));
    formElement.reset();
    setInfo(`${data.username} dibuat.`);
  }

  async function save(row: UserRow, password: string, decision?: AccountStatus) {
    setError("");
    setInfo("");
    const body: Record<string, unknown> = {
      name: row.name,
      role: row.role,
      kotamaopsId: row.role === "OPERATOR_KODAM" ? row.kotamaopsId : null,
      password,
    };
    if (decision) body.accountStatus = decision;
    else body.active = row.active;
    const response = await fetch(`/api/ops/users/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(typeof data.error === "string" ? data.error : "Perubahan gagal disimpan.");
      return;
    }
    setUsers((current) => current.map((item) => (item.id === row.id ? data : item)));
    setInfo(`${data.username} disimpan.`);
  }

  function change(id: string, patch: Partial<UserRow>) {
    setUsers((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  const waiting = users.filter((row) => row.accountStatus === "PENDING");
  const rest = users.filter((row) => row.accountStatus !== "PENDING");

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <p role="status" aria-atomic="true" className="sr-only">{info}</p>
      <p role="alert" aria-atomic="true" className="sr-only">{error}</p>
      <div className="space-y-6">
        {(error || info) && (
          <p key={error || info} className={`ops-fade rounded border px-3 py-2 text-sm ${error ? "border-rose-300/40 text-rose-200" : "border-[var(--gold-primary)]/40 text-[var(--gold-primary)]"}`}>
            {error || info}
          </p>
        )}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">
            Menunggu persetujuan <span className="text-white/50">({waiting.length})</span>
          </h2>
          {waiting.length === 0 && <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-white/60">Tidak ada akun yang menunggu.</p>}
          {waiting.map((row, index) => (
            <UserCard key={row.id} index={index} actorRole={actorRole} row={row} kotamaops={kotamaops} open onToggle={() => {}} onChange={change} onSave={save} />
          ))}
        </section>
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">
            Akun terdaftar <span className="text-white/50">({rest.length})</span>
          </h2>
          {rest.map((row, index) => (
            <UserCard
              key={row.id}
              index={index}
              actorRole={actorRole}
              row={row}
              kotamaops={kotamaops}
              open={openId === row.id}
              onToggle={() => setOpenId((current) => (current === row.id ? "" : row.id))}
              onChange={change}
              onSave={save}
            />
          ))}
        </section>
      </div>
      <aside className="space-y-3 lg:sticky lg:top-6 lg:self-start">
        <form onSubmit={create} className="ops-rise grid gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <h2 className="text-sm font-semibold">Pengguna baru</h2>
          <label className="grid gap-1 text-xs text-white/60">
            Nama
            <input name="name" required className="rounded border border-[var(--control-border)] bg-black/40 px-3 py-2 text-sm text-white" />
          </label>
          <label className="grid gap-1 text-xs text-white/60">
            Nama pengguna
            <input name="username" required placeholder="nama.pengguna" className="rounded border border-[var(--control-border)] bg-black/40 px-3 py-2 text-sm text-white" />
          </label>
          <label className="grid gap-1 text-xs text-white/60">
            Kata sandi
            <input name="password" required type="password" placeholder="Minimal 10 karakter" autoComplete="new-password" className="rounded border border-[var(--control-border)] bg-black/40 px-3 py-2 text-sm text-white" />
          </label>
          <label className="grid gap-1 text-xs text-white/60">
            Peran
            <select name="role" defaultValue="OPERATOR_KODAM" className="rounded border border-[var(--control-border)] bg-black/40 px-3 py-2 text-sm text-white">
              {roleChoices(actorRole).map(([role, label]) => (
                <option key={role} value={role}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-white/60">
            Kotamaops
            <select name="kotamaopsId" className="rounded border border-[var(--control-border)] bg-black/40 px-3 py-2 text-sm text-white">
              <option value="">Tanpa Kotamaops</option>
              {kotamaops.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.code} · {unit.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="rounded bg-[var(--gold-primary)] px-3 py-2 text-sm font-bold text-black">
            Buat pengguna
          </button>
        </form>
      </aside>
    </div>
  );
}

function UserCard({
  index,
  actorRole,
  row,
  kotamaops,
  open,
  onToggle,
  onChange,
  onSave,
}: {
  index: number;
  actorRole: string;
  row: UserRow;
  kotamaops: Unit[];
  open: boolean;
  onToggle: () => void;
  onChange: (id: string, patch: Partial<UserRow>) => void;
  onSave: (row: UserRow, password: string, decision?: AccountStatus) => Promise<void>;
}) {
  const lockSuperAdmin = row.role === "SUPER_ADMIN" && actorRole !== "SUPER_ADMIN";
  return (
    <article style={{ "--i": Math.min(index, 10) } as React.CSSProperties} className={`ops-rise rounded-xl border p-4 ${open ? "border-white/20 bg-white/[0.03]" : "border-white/10"}`}>
      <button type="button" onClick={onToggle} className="flex w-full flex-wrap items-start justify-between gap-2 text-left" aria-expanded={open}>
        <span className="min-w-0">
          <span className="block text-sm font-semibold">{row.name}</span>
          <span className="mt-1 block break-words text-xs text-white/55">
            @{row.username}
            {row.email ? ` · ${row.email}` : ""}
            {row.organization ? ` · ${row.organization}` : ""}
            {row.position ? ` · ${row.position}` : ""}
          </span>
          <span className="mt-1 block text-[11px] text-white/40">
            Dibuat {stamp(row.createdAt)} WIB{row.lastLoginAt ? ` · masuk terakhir ${stamp(row.lastLoginAt)} WIB` : ""}
          </span>
        </span>
        <span className="flex flex-wrap gap-1.5 text-[10px] font-bold tracking-wider">
          <span className="rounded border border-white/15 px-2 py-1 text-white/70">
            {roleLabel[row.role] ?? row.role}
            {row.kotamaops ? ` · ${row.kotamaops.code}` : ""}
          </span>
          <span className={`rounded border px-2 py-1 ${statusTone[row.accountStatus] ?? "border-white/20"}`}>{statusLabel[row.accountStatus] ?? row.accountStatus}</span>
        </span>
      </button>
      {open && lockSuperAdmin && (
        <p className="ops-fade mt-4 border-t border-white/10 pt-4 text-sm text-white/60">Hanya super admin yang dapat mengubah akun super admin.</p>
      )}
      {open && !lockSuperAdmin && (
        <div className="ops-fade mt-4 grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-2">
          <input value={row.name} onChange={(event) => onChange(row.id, { name: event.target.value })} aria-label={`Nama ${row.username}`} className="rounded border border-[var(--control-border)] bg-black/40 px-3 py-2" />
          <select value={row.role} disabled={lockSuperAdmin} onChange={(event) => onChange(row.id, { role: event.target.value })} aria-label={`Peran ${row.username}`} className="rounded border border-[var(--control-border)] bg-black/40 px-3 py-2 disabled:opacity-60">
            {roleChoices(actorRole, row.role).map(([role, label]) => (
              <option key={role} value={role}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={row.kotamaopsId ?? ""}
            disabled={row.role !== "OPERATOR_KODAM"}
            onChange={(event) => onChange(row.id, { kotamaopsId: event.target.value || null })}
            aria-label={`Kotamaops ${row.username}`}
            className="rounded border border-[var(--control-border)] bg-black/40 px-3 py-2 disabled:opacity-40"
          >
            <option value="">Pilih Kotamaops</option>
            {kotamaops.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.code}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={row.active} onChange={(event) => onChange(row.id, { active: event.target.checked })} />
            Aktif
          </label>
          <input id={`password-${row.id}`} type="password" autoComplete="new-password" placeholder="Kata sandi baru, kosongkan jika tetap" aria-label={`Kata sandi baru ${row.username}`} className="rounded border border-[var(--control-border)] bg-black/40 px-3 py-2 sm:col-span-2" />
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            {row.accountStatus === "PENDING" && (
              <>
                <button type="button" onClick={() => void onSave(row, "", "ACTIVE")} className="rounded bg-[var(--gold-primary)] px-3 py-2 text-xs font-bold text-black">
                  Setujui
                </button>
                <button type="button" onClick={() => void onSave(row, "", "REJECTED")} className="rounded border border-rose-300/50 px-3 py-2 text-xs font-bold text-rose-200">
                  Tolak
                </button>
              </>
            )}
            {row.accountStatus !== "PENDING" && (
              <button
                type="button"
                onClick={() => {
                  const field = document.getElementById(`password-${row.id}`) as HTMLInputElement | null;
                  void onSave(row, field?.value ?? "");
                  if (field) field.value = "";
                }}
                className="rounded border border-[var(--gold-primary)] px-3 py-2 text-xs font-bold text-[var(--gold-primary)]"
              >
                Simpan pengguna
              </button>
            )}
            {row.accountStatus === "ACTIVE" && (
              <button type="button" onClick={() => void onSave(row, "", "DISABLED")} className="rounded border border-white/20 px-3 py-2 text-xs font-bold">
                Nonaktifkan
              </button>
            )}
            {(row.accountStatus === "DISABLED" || row.accountStatus === "REJECTED") && (
              <button type="button" onClick={() => void onSave(row, "", "ACTIVE")} className="rounded border border-white/20 px-3 py-2 text-xs font-bold">
                Aktifkan
              </button>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
