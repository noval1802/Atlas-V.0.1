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

  async function logout() {
    await fetch("/api/ops/logout", { method: "POST" });
    window.location.assign("/masuk");
  }

  function change(id: string, patch: Partial<UserRow>) {
    setUsers((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  const waiting = users.filter((row) => row.accountStatus === "PENDING");
  const rest = users.filter((row) => row.accountStatus !== "PENDING");

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button type="button" onClick={logout} className="rounded border border-white/15 px-3 py-2 text-xs font-bold">
          KELUAR
        </button>
        <p role="status" aria-atomic="true" className="sr-only">{info}</p>
        <p role="alert" aria-atomic="true" className="sr-only">{error}</p>
      </div>
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Menunggu persetujuan ({waiting.length})</h2>
        {waiting.length === 0 && <p className="text-sm text-white/60">Tidak ada akun yang menunggu.</p>}
        {waiting.map((row) => (
          <UserCard key={row.id} actorRole={actorRole} row={row} kotamaops={kotamaops} open onToggle={() => setOpenId(row.id)} onChange={change} onSave={save} />
        ))}
      </section>
      <form onSubmit={create} className="grid gap-3 rounded-xl border border-white/10 p-4 sm:grid-cols-2">
        <h2 className="sm:col-span-2 text-sm font-semibold">Pengguna baru oleh admin</h2>
        <input name="name" required placeholder="Nama" className="rounded border border-[var(--control-border)] bg-black/40 px-3 py-2" />
        <input name="username" required placeholder="nama.pengguna" className="rounded border border-[var(--control-border)] bg-black/40 px-3 py-2" />
        <input name="password" required type="password" placeholder="Kata sandi, minimal 10" autoComplete="new-password" className="rounded border border-[var(--control-border)] bg-black/40 px-3 py-2" />
        <select name="role" defaultValue="OPERATOR_KODAM" className="rounded border border-[var(--control-border)] bg-black/40 px-3 py-2">
          {roleChoices(actorRole).map(([role, label]) => (
            <option key={role} value={role}>
              {label}
            </option>
          ))}
        </select>
        <select name="kotamaopsId" className="rounded border border-[var(--control-border)] bg-black/40 px-3 py-2 sm:col-span-2">
          <option value="">Tanpa Kotamaops</option>
          {kotamaops.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.code} · {unit.name}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded bg-[var(--gold-primary)] px-3 py-2 text-sm font-bold text-black sm:col-span-2">
          Buat pengguna
        </button>
      </form>
      {error && <p className="text-sm text-rose-300">{error}</p>}
      {info && <p className="text-sm text-[var(--gold-primary)]">{info}</p>}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Akun lain</h2>
        {rest.map((row) => (
          <UserCard key={row.id} actorRole={actorRole} row={row} kotamaops={kotamaops} open={openId === row.id} onToggle={() => setOpenId(row.id)} onChange={change} onSave={save} />
        ))}
      </section>
    </div>
  );
}

function UserCard({
  actorRole,
  row,
  kotamaops,
  open,
  onToggle,
  onChange,
  onSave,
}: {
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
    <article className="rounded-xl border border-white/10 p-4">
      <button type="button" onClick={onToggle} className="w-full text-left" aria-expanded={open}>
        <span className="text-sm font-semibold">{row.name}</span>
        <span className="mt-1 block text-xs text-white/55">
          {row.username} · {row.email || "—"} · {row.organization || "—"} · {row.position || "—"} · {stamp(row.createdAt)} WIB · {statusLabel[row.accountStatus] ?? row.accountStatus}
        </span>
      </button>
      {open && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
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
            className="rounded border border-[var(--control-border)] bg-black/40 px-3 py-2"
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
