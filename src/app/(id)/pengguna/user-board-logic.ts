/** Pure helpers for the user management board, kept apart so they can be tested without a DOM. */

export type AccountStatus = "PENDING" | "ACTIVE" | "REJECTED" | "DISABLED";
export type Unit = { id: string; code: string; name: string };
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
export type AuditRow = {
  id: string;
  at: string;
  action: string;
  label: string;
  result: string;
  actor: string | null;
  target: string | null;
  ip: string;
  detail: string;
};
/** What the edit dialog holds before it is saved. */
export type UserDraft = {
  name: string;
  role: string;
  kotamaopsId: string | null;
  active: boolean;
  password: string;
  confirmPassword: string;
};

export const ROLE_OPTIONS = [
  ["SUPER_ADMIN", "Admin bootstrap"],
  ["ADMIN", "Admin"],
  ["OPERATOR_PUSDALOPS", "Operator pusat"],
  ["OPERATOR_KODAM", "Operator Kotamaops"],
  ["ANALYST", "Viewer"],
  ["PIMPINAN", "Monitoring"],
] as const;

export const ROLE_LABEL: Record<string, string> = Object.fromEntries(ROLE_OPTIONS);

export const STATUS_LABEL: Record<AccountStatus, string> = {
  PENDING: "Menunggu",
  ACTIVE: "Aktif",
  REJECTED: "Ditolak",
  DISABLED: "Nonaktif",
};

/** An admin may not offer SUPER_ADMIN; a super admin row keeps its role for an admin. */
export function roleChoices(actorRole: string, current?: string) {
  if (actorRole === "SUPER_ADMIN") return ROLE_OPTIONS;
  if (current === "SUPER_ADMIN") return ROLE_OPTIONS.filter(([role]) => role === "SUPER_ADMIN");
  return ROLE_OPTIONS.filter(([role]) => role !== "SUPER_ADMIN");
}

export function lockedForActor(actorRole: string, row: Pick<UserRow, "role">): boolean {
  return row.role === "SUPER_ADMIN" && actorRole !== "SUPER_ADMIN";
}

export function draftFrom(row: UserRow): UserDraft {
  return { name: row.name, role: row.role, kotamaopsId: row.kotamaopsId, active: row.active, password: "", confirmPassword: "" };
}

/**
 * PATCH body for the users API. The API takes exactly one of `active` or `accountStatus`,
 * and `kotamaopsId` only for OPERATOR_KODAM.
 */
export function editBody(draft: UserDraft): Record<string, unknown> {
  return {
    name: draft.name,
    role: draft.role,
    kotamaopsId: draft.role === "OPERATOR_KODAM" ? draft.kotamaopsId : null,
    password: draft.password,
    confirmPassword: draft.confirmPassword,
    active: draft.active,
  };
}

/** A status decision always sends the saved row, never edits that were not saved. */
export function decisionBody(saved: UserRow, decision: AccountStatus): Record<string, unknown> {
  return {
    name: saved.name,
    role: saved.role,
    kotamaopsId: saved.role === "OPERATOR_KODAM" ? saved.kotamaopsId : null,
    password: "",
    confirmPassword: "",
    accountStatus: decision,
  };
}

/** Changes that end sessions or widen access, listed for the confirmation step. Empty means none. */
export function riskyChanges(saved: UserRow, draft: UserDraft): string[] {
  const out: string[] = [];
  if (draft.role !== saved.role) out.push(`Peran berubah: ${saved.role} → ${draft.role}.`);
  if (draft.password) out.push("Kata sandi diganti. Semua sesi pengguna ini langsung berakhir.");
  if (saved.active && !draft.active) out.push("Akun dinonaktifkan. Semua sesi pengguna ini langsung berakhir.");
  if (!saved.active && draft.active) out.push("Akun diaktifkan dan bisa masuk lagi.");
  return out;
}

export type UserFilter = { query: string; role: string; status: string; sort: "name-asc" | "name-desc" | "login-desc" };

export function filterUsers(rows: UserRow[], filter: UserFilter): UserRow[] {
  const query = filter.query.trim().toLowerCase();
  const kept = rows.filter((row) => {
    if (filter.role && row.role !== filter.role) return false;
    if (filter.status && row.accountStatus !== filter.status) return false;
    if (!query) return true;
    return [row.name, row.username, row.email ?? ""].some((value) => value.toLowerCase().includes(query));
  });
  const byName = (a: UserRow, b: UserRow) => a.name.localeCompare(b.name, "id");
  if (filter.sort === "name-desc") return kept.sort((a, b) => byName(b, a));
  if (filter.sort === "login-desc") {
    return kept.sort((a, b) => (b.lastLoginAt ?? "").localeCompare(a.lastLoginAt ?? "") || byName(a, b));
  }
  return kept.sort(byName);
}

export type AuditFilter = { days: number; action: string; user: string };

export function filterAudits(rows: AuditRow[], filter: AuditFilter, now: number): AuditRow[] {
  const since = filter.days > 0 ? now - filter.days * 86_400_000 : -Infinity;
  return rows.filter((row) => {
    if (Date.parse(row.at) < since) return false;
    if (filter.action && row.action !== filter.action) return false;
    if (filter.user && row.actor !== filter.user && row.target !== filter.user) return false;
    return true;
  });
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
}

export function stamp(value: string): string {
  return new Date(value).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" });
}

export function ago(value: string, now: number): string {
  const seconds = Math.round((now - Date.parse(value)) / 1000);
  if (seconds < 60) return "Baru saja";
  const format = new Intl.RelativeTimeFormat("id", { numeric: "auto" });
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return format.format(-minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (hours < 24) return format.format(-hours, "hour");
  return format.format(-Math.round(hours / 24), "day");
}

/** Display label for an audit result; the raw value stays in the database and in the row's tooltip. */
export function auditOutcome(result: string): { label: string; tone: "ok" | "pending" | "fail" } {
  if (result === "ok" || result === "sent") return { label: "Berhasil", tone: "ok" };
  if (result === "pending") return { label: "Menunggu", tone: "pending" };
  return { label: "Gagal", tone: "fail" };
}
