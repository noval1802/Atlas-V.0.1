"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownUp, BarChart3, CalendarDays, Check, ChevronRight, Clock3, MoreVertical, Pencil, Search, ShieldCheck, UserPlus, Users, X } from "lucide-react";
import {
  ago,
  auditOutcome,
  decisionBody,
  editBody,
  filterAudits,
  filterUsers,
  initials,
  lockedForActor,
  ROLE_LABEL,
  ROLE_OPTIONS,
  STATUS_LABEL,
  stamp,
  type AccountStatus,
  type AuditRow,
  type Unit,
  type UserDraft,
  type UserFilter,
  type UserRow,
} from "./user-board-logic";
import { CreateUserForm, EditUserDialog } from "./user-forms";
import { Avatar, ConfirmDialog, fieldBase, Panel, PanelTitle, RoleBadge, StatusBadge, type Confirmation } from "./user-ui";

export type { UserRow } from "./user-board-logic";

const NETWORK_ERROR = "Jaringan bermasalah. Coba lagi.";
const selectClass = `${fieldBase} w-full sm:w-auto sm:min-w-[150px]`;

/** Current time for relative stamps, set after mount so server and client markup agree. */
function useNow() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

async function send(url: string, method: "POST" | "PATCH", body: Record<string, unknown>): Promise<{ ok: true; data: UserRow } | { ok: false; error: string }> {
  try {
    const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, error: typeof data.error === "string" ? data.error : "Perubahan gagal disimpan." };
    return { ok: true, data: data as UserRow };
  } catch {
    return { ok: false, error: NETWORK_ERROR };
  }
}

export function UserBoard({
  actorRole,
  initialUsers,
  kotamaops,
  audits,
}: {
  actorRole: string;
  initialUsers: UserRow[];
  kotamaops: Unit[];
  audits: AuditRow[];
}) {
  const now = useNow();
  const [users, setUsers] = useState(initialUsers);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [menuId, setMenuId] = useState("");
  const [filter, setFilter] = useState<UserFilter>({ query: "", role: "", status: "", sort: "name-asc" });

  const waiting = users.filter((row) => row.accountStatus === "PENDING");
  const registered = users.filter((row) => row.accountStatus !== "PENDING");
  const visible = useMemo(() => filterUsers(registered, filter), [registered, filter]);
  const superAdmins = users.filter((row) => row.role === "SUPER_ADMIN" && row.accountStatus === "ACTIVE").length;

  function replace(saved: UserRow) {
    setUsers((current) => current.map((item) => (item.id === saved.id ? saved : item)));
  }

  function decide(row: UserRow, decision: AccountStatus) {
    const copy: Record<AccountStatus, Omit<Confirmation, "run">> = {
      ACTIVE:
        row.accountStatus === "PENDING"
          ? { title: "Setujui pendaftaran?", action: "Setujui", lines: [`${row.name} (${row.username}) disetujui sebagai ${row.role} · ${ROLE_LABEL[row.role] ?? row.role}.`, "Akun langsung bisa masuk. Peran dapat diubah sesudahnya lewat Ubah."] }
          : { title: "Aktifkan akun?", action: "Aktifkan", lines: [`${row.name} (${row.username}) bisa masuk lagi dengan peran ${row.role}.`] },
      REJECTED: { title: "Tolak pendaftaran?", action: "Tolak", danger: true, lines: [`Pendaftaran ${row.name} (${row.username}) ditolak.`, "Akun tidak bisa masuk sampai diaktifkan kembali oleh admin."] },
      DISABLED: { title: "Nonaktifkan akun?", action: "Nonaktifkan", danger: true, lines: [`${row.name} (${row.username}) tidak bisa masuk lagi.`, "Semua sesi pengguna ini langsung berakhir."] },
      PENDING: { title: "", action: "", lines: [] },
    };
    setMenuId("");
    setConfirmation({
      ...copy[decision],
      run: async () => {
        setBusy(true);
        const result = await send(`/api/ops/users/${row.id}`, "PATCH", decisionBody(row, decision));
        setBusy(false);
        setConfirmation(null);
        if (!result.ok) return setNotice({ kind: "error", text: result.error });
        replace(result.data);
        setNotice({ kind: "ok", text: `${result.data.username}: ${STATUS_LABEL[result.data.accountStatus].toLowerCase()}.` });
      },
    });
  }

  async function saveEdit(row: UserRow, draft: UserDraft): Promise<string | null> {
    const result = await send(`/api/ops/users/${row.id}`, "PATCH", editBody(draft));
    if (!result.ok) return result.error;
    replace(result.data);
    setEditing(null);
    setNotice({ kind: "ok", text: `${result.data.username} disimpan.` });
    return null;
  }

  async function create(body: Record<string, unknown>): Promise<string | null> {
    const result = await send("/api/ops/users", "POST", body);
    if (!result.ok) return result.error;
    setUsers((current) => [...current, result.data]);
    setNotice({ kind: "ok", text: `${result.data.username} dibuat dan langsung aktif.` });
    return null;
  }

  function actions(row: UserRow) {
    const locked = lockedForActor(actorRole, row);
    return (
      <div className="relative flex items-center gap-1">
        <button
          type="button"
          disabled={locked || busy}
          title={locked ? "Hanya super admin yang dapat mengubah akun super admin." : undefined}
          onClick={() => setEditing(row)}
          className="flex h-9 items-center gap-2 rounded-md border border-white/20 px-3 text-sm font-semibold text-[var(--text-primary)] hover:border-[rgba(var(--cyan-rgb),0.5)] hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Pencil className="h-4 w-4" aria-hidden="true" /> Ubah
        </button>
        {!locked && <RowMenu row={row} open={menuId === row.id} busy={busy} onToggle={() => setMenuId((current) => (current === row.id ? "" : row.id))} onClose={() => setMenuId("")} onDecide={decide} />}
      </div>
    );
  }

  const stats = [
    { href: "#menunggu", icon: <UserPlus className="h-7 w-7" />, value: waiting.length, label: "Menunggu persetujuan", highlight: waiting.length > 0 },
    { href: "#akun", icon: <Users className="h-7 w-7" />, value: registered.length, label: "Akun terdaftar" },
    { href: "#akun", icon: <ShieldCheck className="h-7 w-7" />, value: superAdmins, label: "SUPER_ADMIN aktif", onClick: () => setFilter((current) => ({ ...current, role: "SUPER_ADMIN", status: "" })) },
    { href: "#jejak", icon: <BarChart3 className="h-7 w-7" />, value: audits.length, label: "Jejak autentikasi", sub: "maks. 80 terbaru" },
  ];

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map((stat) => (
            <a
              key={stat.label}
              href={stat.href}
              onClick={stat.onClick}
              className={`group flex flex-col items-start gap-2 rounded-xl border p-3 transition-colors sm:flex-row sm:items-center sm:gap-4 sm:p-4 hover:border-[rgba(var(--cyan-rgb),0.45)] ${
                stat.highlight
                  ? "border-[rgba(var(--gold-rgb),0.6)] bg-[linear-gradient(135deg,rgba(var(--gold-rgb),0.08),transparent_60%),var(--bg-panel)] shadow-[0_0_24px_-10px_rgba(var(--gold-rgb),0.6)]"
                  : "border-[rgba(var(--cyan-rgb),0.16)] bg-[var(--bg-panel)]"
              }`}
            >
              <span aria-hidden="true" className={stat.highlight ? "text-[var(--gold-primary)]" : "text-[var(--cyan-primary)]"}>{stat.icon}</span>
              <span className="min-w-0 flex-1 break-words">
                <span className="block text-2xl font-semibold leading-tight text-[var(--text-heading)]">{stat.value}</span>
                <span className="block text-[13px] text-[var(--text-secondary)]">{stat.label}</span>
                {stat.sub && <span className="block text-xs text-[var(--text-muted)]">{stat.sub}</span>}
              </span>
              <ChevronRight className="hidden h-5 w-5 text-[var(--text-muted)] transition-transform sm:block group-hover:translate-x-0.5" aria-hidden="true" />
            </a>
          ))}
        </div>

        <div aria-live="polite" aria-atomic="true">
          {notice && (
            <p
              key={notice.text}
              role={notice.kind === "error" ? "alert" : "status"}
              className={`ops-fade flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${
                notice.kind === "error" ? "border-rose-400/50 bg-rose-500/10 text-rose-200" : "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
              }`}
            >
              {notice.text}
              <button type="button" onClick={() => setNotice(null)} aria-label="Tutup pesan" className="opacity-70 hover:opacity-100">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </p>
          )}
        </div>

        <Panel id="menunggu" tone={waiting.length ? "gold" : "cyan"}>
          <PanelTitle icon={<UserPlus className="h-6 w-6" />} title="Menunggu persetujuan" count={`(${waiting.length})`} />
          <div className="space-y-2 p-5 pt-4">
            {waiting.length === 0 && <p className="rounded-lg border border-dashed border-white/10 p-4 text-sm text-[var(--text-muted)]">Tidak ada akun yang menunggu persetujuan.</p>}
            {waiting.map((row) => (
              <article key={row.id} className="grid items-center gap-4 rounded-lg border border-white/10 bg-black/20 p-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.3fr)_minmax(0,1fr)_auto]">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar text={initials(row.name)} />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-[var(--text-heading)]">{row.name}</span>
                    <span className="block truncate text-sm text-[var(--text-muted)]">{row.username}</span>
                  </span>
                </div>
                <div className="min-w-0 text-sm">
                  <span className="block truncate text-[var(--text-primary)]">{row.organization || "—"}</span>
                  <span className="block truncate text-[var(--text-muted)]">{[row.position, row.email].filter(Boolean).join(" · ") || "—"}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                  <CalendarDays className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
                  <span>
                    <span className="block">{stamp(row.createdAt)}</span>
                    {now && <span className="block text-[var(--text-muted)]">{ago(row.createdAt, now)}</span>}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button type="button" disabled={busy} onClick={() => decide(row, "REJECTED")} className="flex h-10 items-center gap-2 rounded-md border border-rose-400/60 px-4 text-sm font-semibold text-rose-300 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-50">
                    <X className="h-4 w-4" aria-hidden="true" /> Tolak
                  </button>
                  <button type="button" disabled={busy} onClick={() => decide(row, "ACTIVE")} className="flex h-10 items-center gap-2 rounded-md border border-emerald-400/60 bg-emerald-400/10 px-4 text-sm font-semibold text-emerald-300 hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-50">
                    <Check className="h-4 w-4" aria-hidden="true" /> Setujui
                  </button>
                </div>
              </article>
            ))}
          </div>
        </Panel>

        <Panel id="akun">
          <PanelTitle icon={<Users className="h-6 w-6" />} title="Akun terdaftar" count={`(${visible.length === registered.length ? registered.length : `${visible.length} dari ${registered.length}`})`}>
            <label className="relative">
              <span className="sr-only">Cari pengguna</span>
              <input
                type="search"
                value={filter.query}
                onChange={(event) => setFilter((current) => ({ ...current, query: event.target.value }))}
                placeholder="Cari nama, username, atau email…"
                className={`${fieldBase} w-full pl-9 sm:w-72`}
              />
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true" />
            </label>
            <select aria-label="Filter peran" value={filter.role} onChange={(event) => setFilter((current) => ({ ...current, role: event.target.value }))} className={selectClass}>
              <option value="">Semua peran</option>
              {ROLE_OPTIONS.map(([role]) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            <select aria-label="Filter status" value={filter.status} onChange={(event) => setFilter((current) => ({ ...current, status: event.target.value }))} className={selectClass}>
              <option value="">Semua status</option>
              {(["ACTIVE", "DISABLED", "REJECTED"] as const).map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABEL[status]}
                </option>
              ))}
            </select>
            <label className="relative">
              <span className="sr-only">Urutkan</span>
              <ArrowDownUp className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true" />
              <select value={filter.sort} onChange={(event) => setFilter((current) => ({ ...current, sort: event.target.value as UserFilter["sort"] }))} className={`${selectClass} pl-9`}>
                <option value="name-asc">Urut: Nama A – Z</option>
                <option value="name-desc">Urut: Nama Z – A</option>
                <option value="login-desc">Urut: Terakhir masuk</option>
              </select>
            </label>
          </PanelTitle>
          <ul className="space-y-3 p-5 pt-4 lg:hidden">
            {visible.length === 0 && <li className="py-6 text-center text-sm text-[var(--text-muted)]">Tidak ada akun yang cocok dengan filter.</li>}
            {visible.map((row) => (
              <li key={row.id} className="rounded-lg border border-white/10 bg-black/20 p-4">
                <div className="flex items-center gap-3">
                  <Avatar text={initials(row.name)} />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-[var(--text-heading)]">{row.name}</span>
                    <span className="block truncate text-[13px] text-[var(--text-muted)]">{[row.username, row.email].filter(Boolean).join(" · ")}</span>
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <RoleBadge role={row.role} />
                  <StatusBadge status={row.accountStatus} />
                  {row.kotamaops && <span className="text-[13px] text-[var(--text-secondary)]">{row.kotamaops.code}</span>}
                </div>
                <p className="mt-2 text-[13px] text-[var(--text-muted)]">
                  Terakhir masuk: {row.lastLoginAt ? `${stamp(row.lastLoginAt)}${now ? ` · ${ago(row.lastLoginAt, now)}` : ""}` : "belum pernah"}
                </p>
                <div className="mt-3">{actions(row)}</div>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto p-5 pt-4 lg:block">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-white/[0.03] text-xs uppercase tracking-[0.1em] text-[var(--text-muted)]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Pengguna</th>
                  <th className="px-4 py-3 font-semibold">Peran</th>
                  <th className="px-4 py-3 font-semibold">Kotamaops</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Terakhir masuk</th>
                  <th className="px-4 py-3 font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-[var(--text-muted)]">
                      Tidak ada akun yang cocok dengan filter.
                    </td>
                  </tr>
                )}
                {visible.map((row) => {
                  return (
                    <tr key={row.id} className="hover:bg-white/[0.03]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar text={initials(row.name)} />
                          <span className="min-w-0">
                            <span className="block font-semibold text-[var(--text-heading)]">{row.name}</span>
                            <span className="block text-[13px] text-[var(--text-muted)]">{row.username}</span>
                            {row.email && <span className="block text-[13px] text-[var(--text-muted)]">{row.email}</span>}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3"><RoleBadge role={row.role} /></td>
                      <td className="px-4 py-3 text-[var(--text-primary)]">{row.kotamaops ? <span title={row.kotamaops.name}>{row.kotamaops.code}</span> : "—"}</td>
                      <td className="px-4 py-3"><StatusBadge status={row.accountStatus} /></td>
                      <td className="px-4 py-3">
                        {row.lastLoginAt ? (
                          <>
                            <span className="block text-[var(--text-primary)]">{stamp(row.lastLoginAt)}</span>
                            {now && (
                              <span className="mt-0.5 flex items-center gap-2 text-[13px] text-[var(--text-muted)]">
                                <span aria-hidden="true" className={`h-2 w-2 rounded-full ${now - Date.parse(row.lastLoginAt) < 3_600_000 ? "bg-emerald-400" : "bg-white/25"}`} />
                                {ago(row.lastLoginAt, now)}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-[var(--text-muted)]">Belum pernah</span>
                        )}
                      </td>
                      <td className="px-4 py-3">{actions(row)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        <AuditPanel audits={audits} now={now} />
      </div>

      <aside className="xl:sticky xl:top-6 xl:self-start">
        <Panel>
          <CreateUserForm actorRole={actorRole} kotamaops={kotamaops} onCreate={create} />
        </Panel>
      </aside>

      {confirmation && <ConfirmDialog confirmation={confirmation} busy={busy} onClose={() => setConfirmation(null)} />}
      {editing && <EditUserDialog row={editing} actorRole={actorRole} kotamaops={kotamaops} onClose={() => setEditing(null)} onSave={(draft) => saveEdit(editing, draft)} />}
    </div>
  );
}

function RowMenu({ row, open, busy, onToggle, onClose, onDecide }: { row: UserRow; open: boolean; busy: boolean; onToggle: () => void; onClose: () => void; onDecide: (row: UserRow, decision: AccountStatus) => void }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) onClose();
    };
    const escape = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open, onClose]);
  const decision: AccountStatus | null = row.accountStatus === "ACTIVE" ? "DISABLED" : row.accountStatus === "DISABLED" || row.accountStatus === "REJECTED" ? "ACTIVE" : null;
  if (!decision) return null;
  return (
    <div ref={root} className="relative">
      <button type="button" onClick={onToggle} disabled={busy} aria-haspopup="menu" aria-expanded={open} aria-label={`Aksi lain untuk ${row.username}`} className="grid h-9 w-9 place-items-center rounded-md text-[var(--text-muted)] hover:bg-white/5 hover:text-[var(--text-primary)] disabled:opacity-40">
        <MoreVertical className="h-4 w-4" aria-hidden="true" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-10 z-20 w-44 rounded-lg border border-white/15 bg-[var(--bg-secondary)] p-1 shadow-xl">
          <button
            type="button"
            role="menuitem"
            onClick={() => onDecide(row, decision)}
            className={`flex min-h-10 w-full items-center rounded px-3 text-left text-sm hover:bg-white/5 ${decision === "DISABLED" ? "text-rose-300" : "text-emerald-300"}`}
          >
            {decision === "DISABLED" ? "Nonaktifkan akun" : "Aktifkan akun"}
          </button>
        </div>
      )}
    </div>
  );
}

function AuditPanel({ audits, now }: { audits: AuditRow[]; now: number | null }) {
  const [days, setDays] = useState(30);
  const [action, setAction] = useState("");
  const [user, setUser] = useState("");
  const actions = useMemo(() => [...new Map(audits.map((row) => [row.action, row.label])).entries()].sort((a, b) => a[1].localeCompare(b[1], "id")), [audits]);
  const people = useMemo(() => [...new Set(audits.flatMap((row) => [row.actor, row.target]).filter((name): name is string => Boolean(name)))].sort(), [audits]);
  const rows = now === null ? audits : filterAudits(audits, { days, action, user }, now);
  const dot = (row: AuditRow) => {
    const tone = auditOutcome(row.result).tone;
    return tone === "ok" ? (row.action === "logout" ? "bg-white/40" : "bg-emerald-400") : tone === "pending" ? "bg-amber-400" : "bg-rose-400";
  };
  const outcome = (row: AuditRow) => {
    const { label, tone } = auditOutcome(row.result);
    return <span title={`Nilai tercatat: ${row.result}`} className={tone === "ok" ? "text-emerald-300" : tone === "pending" ? "text-amber-300" : "text-rose-300"}>{label}</span>;
  };

  return (
    <Panel id="jejak">
      <PanelTitle icon={<Clock3 className="h-6 w-6" />} title="Jejak autentikasi" count={`(${rows.length} dari ${audits.length} terbaru)`}>
        <select aria-label="Rentang waktu" value={days} onChange={(event) => setDays(Number(event.target.value))} className={selectClass}>
          <option value={1}>24 jam terakhir</option>
          <option value={7}>7 hari terakhir</option>
          <option value={30}>30 hari terakhir</option>
          <option value={0}>Semua (80 terbaru)</option>
        </select>
        <select aria-label="Filter aksi" value={action} onChange={(event) => setAction(event.target.value)} className={selectClass}>
          <option value="">Semua aksi</option>
          {actions.map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <select aria-label="Filter pengguna" value={user} onChange={(event) => setUser(event.target.value)} className={selectClass}>
          <option value="">Semua pengguna</option>
          {people.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </PanelTitle>
      <ul className="max-h-[30rem] space-y-2 overflow-y-auto p-5 pt-4 md:hidden">
        {rows.length === 0 && <li className="py-6 text-center text-sm text-[var(--text-muted)]">Tidak ada catatan pada filter ini.</li>}
        {rows.map((row) => (
          <li key={row.id} className="rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2 font-semibold text-[var(--text-primary)]">
                <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${dot(row)}`} />
                {row.label}
              </span>
              <span className="shrink-0 text-[13px] font-semibold">{outcome(row)}</span>
            </div>
            <p className="mt-1 text-[13px] text-[var(--text-muted)]">{stamp(row.at)} WIB</p>
            <p className="mt-1 break-words text-[13px] text-[var(--text-secondary)]">
              {row.actor ?? "—"} → {row.target ?? "—"} · {[row.ip, row.detail].filter(Boolean).join(" · ") || "—"}
            </p>
          </li>
        ))}
      </ul>
      <div className="hidden max-h-[30rem] overflow-auto p-5 pt-4 md:block">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="sticky top-0 bg-[var(--bg-secondary)] text-xs uppercase tracking-[0.1em] text-[var(--text-muted)]">
            <tr>
              <th className="px-4 py-3 font-semibold">Waktu (WIB)</th>
              <th className="px-4 py-3 font-semibold">Aksi</th>
              <th className="px-4 py-3 font-semibold">Hasil</th>
              <th className="px-4 py-3 font-semibold">Pengguna → target</th>
              <th className="px-4 py-3 font-semibold">IP / detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05] text-[var(--text-primary)]">
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[var(--text-muted)]">
                  Tidak ada catatan pada filter ini.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-white/[0.03]">
                <td className="whitespace-nowrap px-4 py-2.5 text-[var(--text-secondary)]">{stamp(row.at)}</td>
                <td className="px-4 py-2.5">
                  <span className="flex items-center gap-2">
                    <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${dot(row)}`} />
                    {row.label}
                  </span>
                </td>
                <td className="px-4 py-2.5 font-semibold">{outcome(row)}</td>
                <td className="px-4 py-2.5">
                  {row.actor ?? "—"} → {row.target ?? "—"}
                </td>
                <td className="px-4 py-2.5 text-[var(--text-secondary)]">{[row.ip, row.detail].filter(Boolean).join(" · ") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
