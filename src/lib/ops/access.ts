import { passwordProblem } from "../../../prisma/password-policy.mjs";

export const OPS_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "OPERATOR_PUSDALOPS",
  "OPERATOR_KODAM",
  "ANALYST",
  "PIMPINAN",
] as const;

export type OpsRoleName = (typeof OPS_ROLES)[number];
export const OPS_STATUSES = ["KONDUSIF", "WASPADA", "SIAGA"] as const;
export type OpsStatusName = (typeof OPS_STATUSES)[number];

export const ACCOUNT_STATUSES = ["PENDING", "ACTIVE", "REJECTED", "DISABLED"] as const;
export type AccountStatusName = (typeof ACCOUNT_STATUSES)[number];

const EMAIL = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

const USERNAME = /^[a-z0-9][a-z0-9._-]{2,31}$/;

export function canManageUsers(role: string): boolean {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

/**
 * Granting or removing SUPER_ADMIN is limited to a super admin.
 * The actor role must come from the verified session. Leaving the role
 * unchanged does not count as a grant or a removal.
 */
export function superAdminRoleChangeError(
  actorRole: string,
  existingRole: string | null,
  nextRole: string,
): string | null {
  if (actorRole === "SUPER_ADMIN") return null;
  const grants = nextRole === "SUPER_ADMIN" && existingRole !== "SUPER_ADMIN";
  const removes = existingRole === "SUPER_ADMIN" && nextRole !== "SUPER_ADMIN";
  if (!grants && !removes) return null;
  return "Hanya super admin yang dapat mengubah peran super admin.";
}

export function canWriteSituation(role: string): boolean {
  return (
    role === "SUPER_ADMIN" ||
    role === "ADMIN" ||
    role === "OPERATOR_PUSDALOPS" ||
    role === "OPERATOR_KODAM"
  );
}

export function seesAllKotamaops(role: string): boolean {
  return role !== "OPERATOR_KODAM";
}

/** Peran publik yang diminta dipetakan ke OpsRole yang sudah ada. SUPER_ADMIN tetap bootstrap. */
export function portalLabel(role: string): string {
  if (role === "SUPER_ADMIN" || role === "ADMIN") return "Admin";
  if (role === "OPERATOR_PUSDALOPS" || role === "OPERATOR_KODAM") return "Operator";
  if (role === "ANALYST") return "Viewer";
  if (role === "PIMPINAN") return "Monitoring";
  return "Pengguna";
}

export function homeForRole(role: string): string {
  if (canManageUsers(role)) return "/pengguna";
  if (canWriteSituation(role)) return "/operator";
  return "/peta";
}

export type PortalLink = { href: "/peta" | "/operator" | "/pengguna"; label: string };

/** Halaman yang boleh dibuka peran ini, untuk menu portal. Sama dengan pagar di halaman dan deniedPage. */
export function portalLinks(role: string): PortalLink[] {
  const links: PortalLink[] = [
    { href: "/peta", label: "Peta situasi" },
    { href: "/operator", label: canWriteSituation(role) ? "Dasbor operator" : "Dasbor situasi" },
  ];
  if (canManageUsers(role)) links.push({ href: "/pengguna", label: "Manajemen pengguna" });
  return links;
}

/** Non-admins who open user management are sent to their own home. Null means the page is allowed. */
export function deniedPage(pathname: string, role: string): string | null {
  if (pathname === "/pengguna" || pathname.startsWith("/pengguna/")) {
    if (!canManageUsers(role)) return homeForRole(role);
  }
  return null;
}

/** Read filter for situation rows. A Kodam operator only receives their bound unit. */
export function situationWhere(role: string, kotamaopsId: string | null): { kotamaopsId: string } | Record<string, never> {
  if (seesAllKotamaops(role)) return {};
  return { kotamaopsId: kotamaopsId ?? "__none__" };
}

/** Write check for one situation row. Viewers and other units fail before any update. */
export function mayWriteSituationRow(role: string, userUnit: string | null, rowUnit: string): boolean {
  if (!canWriteSituation(role)) return false;
  if (seesAllKotamaops(role)) return true;
  return Boolean(userUnit) && userUnit === rowUnit;
}

/**
 * Lookup result after the caller is already allowed to write.
 * A missing id and another unit's id share "absent" so the response does not
 * show that the other row exists. Callers who cannot write are rejected earlier.
 */
export function situationWriteLookup(
  role: string,
  userUnit: string | null,
  rowUnit: string | null,
): "allow" | "absent" {
  if (rowUnit === null || !mayWriteSituationRow(role, userUnit, rowUnit)) return "absent";
  return "allow";
}

export function allowedNext(role: string): string[] {
  const monitoring = ["/peta", "/"];
  if (canManageUsers(role)) return ["/pengguna", "/operator", ...monitoring];
  return ["/operator", ...monitoring];
}

/** Login may return only to an allowed path. A map link may keep its `layers` query. */
export function acceptedNext(next: string, allowed: readonly string[]): string | null {
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return null;
  let url: URL;
  try {
    url = new URL(next, "http://osiris.local");
  } catch {
    return null;
  }
  if (url.origin !== "http://osiris.local" || !allowed.includes(url.pathname)) return null;
  const layers = url.searchParams.get("layers");
  const foreign = [...url.searchParams.keys()].some((key) => key !== "layers");
  if (foreign || layers === null) return url.pathname;
  if (layers.length === 0 || layers.length > 500 || /[\r\n]/.test(layers)) return url.pathname;
  return `${url.pathname}?layers=${encodeURIComponent(layers)}`;
}

/** Registrasi publik tidak membaca peran dari klien. */
export function registrationRole(): OpsRoleName {
  return "ANALYST";
}

export function sessionMatchesUser(
  session: { ver?: number },
  user: { active: boolean; accountStatus: string; sessionVersion: number },
): boolean {
  if (!user.active || user.accountStatus !== "ACTIVE") return false;
  return (session.ver ?? 0) === user.sessionVersion;
}

/** Pass the owner's username when known so a password containing it is refused. */
export function passwordError(password: string, username?: string): string | null {
  return passwordProblem(password, username);
}

export function usernameError(username: string): string | null {
  if (!USERNAME.test(username)) {
    return "Nama pengguna 3–32 karakter: huruf kecil, angka, titik, garis bawah, atau strip.";
  }
  return null;
}

export function emailError(email: string): string | null {
  if (email.length > 200 || !EMAIL.test(email)) return "Email tidak valid.";
  return null;
}

export function nextAccountState(
  existing: { active: boolean; accountStatus: AccountStatusName },
  patch: { active?: boolean; accountStatus?: AccountStatusName },
): { active: boolean; accountStatus: AccountStatusName } {
  if (patch.accountStatus) {
    return { accountStatus: patch.accountStatus, active: patch.accountStatus === "ACTIVE" };
  }
  if (patch.active !== undefined) {
    if (patch.active) return { active: true, accountStatus: "ACTIVE" };
    return {
      active: false,
      accountStatus: existing.accountStatus === "REJECTED" ? "REJECTED" : "DISABLED",
    };
  }
  return { active: existing.active, accountStatus: existing.accountStatus };
}

export type SituationInput = {
  status: OpsStatusName;
  personnel: number;
  deployed: number;
  incidentCount: number;
  note: string;
};

export function parseSituation(body: unknown): { ok: true; value: SituationInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Data situasi tidak lengkap." };
  const raw = body as Record<string, unknown>;
  if (!OPS_STATUSES.includes(raw.status as OpsStatusName)) {
    return { ok: false, error: "Status harus KONDUSIF, WASPADA, atau SIAGA." };
  }
  const personnel = readCount(raw.personnel, "Personel");
  if (typeof personnel !== "number") return { ok: false, error: personnel };
  const deployed = readCount(raw.deployed, "Personel dikerahkan");
  if (typeof deployed !== "number") return { ok: false, error: deployed };
  const incidentCount = readCount(raw.incidentCount, "Jumlah kejadian");
  if (typeof incidentCount !== "number") return { ok: false, error: incidentCount };
  if (deployed > personnel) {
    return { ok: false, error: "Personel dikerahkan tidak boleh melebihi jumlah personel." };
  }
  const note = typeof raw.note === "string" ? raw.note.trim() : "";
  if (note.length > 2000) return { ok: false, error: "Catatan maksimal 2000 karakter." };
  return {
    ok: true,
    value: { status: raw.status as OpsStatusName, personnel, deployed, incidentCount, note },
  };
}

function readCount(value: unknown, label: string): number | string {
  const number = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  if (!Number.isInteger(number) || number < 0 || number > 1_000_000) {
    return `${label} harus bilangan bulat 0 sampai 1000000.`;
  }
  return number;
}

export type NewUserInput = {
  name: string;
  username: string;
  password: string;
  role: OpsRoleName;
  kotamaopsId: string | null;
};

export function parseNewUser(body: unknown): { ok: true; value: NewUserInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Data pengguna tidak lengkap." };
  const raw = body as Record<string, unknown>;
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (name.length < 2 || name.length > 120) return { ok: false, error: "Nama 2–120 karakter." };
  const username = typeof raw.username === "string" ? raw.username.trim().toLowerCase() : "";
  const usernameProblem = usernameError(username);
  if (usernameProblem) return { ok: false, error: usernameProblem };
  const password = typeof raw.password === "string" ? raw.password : "";
  const passwordRefusal = passwordError(password, username);
  if (passwordRefusal) return { ok: false, error: passwordRefusal };
  if (!OPS_ROLES.includes(raw.role as OpsRoleName)) return { ok: false, error: "Peran tidak dikenal." };
  const role = raw.role as OpsRoleName;
  const kotamaopsId = typeof raw.kotamaopsId === "string" && raw.kotamaopsId.trim() ? raw.kotamaopsId.trim() : null;
  if (role === "OPERATOR_KODAM" && !kotamaopsId) {
    return { ok: false, error: "Operator Kodam wajib diikat ke satu Kotamaops." };
  }
  return { ok: true, value: { name, username, password, role, kotamaopsId: role === "OPERATOR_KODAM" ? kotamaopsId : null } };
}

export type UserPatch = {
  name?: string;
  role?: OpsRoleName;
  active?: boolean;
  accountStatus?: AccountStatusName;
  kotamaopsId?: string | null;
  password?: string;
};

export function parseUserPatch(body: unknown): { ok: true; value: UserPatch } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Data pengguna tidak lengkap." };
  const raw = body as Record<string, unknown>;
  const patch: UserPatch = {};
  if (raw.name !== undefined) {
    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    if (name.length < 2 || name.length > 120) return { ok: false, error: "Nama 2–120 karakter." };
    patch.name = name;
  }
  if (raw.role !== undefined) {
    if (!OPS_ROLES.includes(raw.role as OpsRoleName)) return { ok: false, error: "Peran tidak dikenal." };
    patch.role = raw.role as OpsRoleName;
  }
  if (raw.active !== undefined) {
    if (typeof raw.active !== "boolean") return { ok: false, error: "Status aktif harus ya atau tidak." };
    patch.active = raw.active;
  }
  if (raw.accountStatus !== undefined) {
    if (!ACCOUNT_STATUSES.includes(raw.accountStatus as AccountStatusName)) {
      return { ok: false, error: "Status akun tidak dikenal." };
    }
    patch.accountStatus = raw.accountStatus as AccountStatusName;
  }
  if (raw.kotamaopsId !== undefined) {
    patch.kotamaopsId = typeof raw.kotamaopsId === "string" && raw.kotamaopsId.trim() ? raw.kotamaopsId.trim() : null;
  }
  if (raw.password !== undefined && raw.password !== "") {
    const password = typeof raw.password === "string" ? raw.password : "";
    const passwordRefusal = passwordError(password);
    if (passwordRefusal) return { ok: false, error: passwordRefusal };
    patch.password = password;
  }
  return { ok: true, value: patch };
}

export type RegisterInput = {
  name: string;
  username: string;
  email: string;
  organization: string;
  position: string;
  password: string;
};

function readText(value: unknown, label: string, min: number, max: number): string | { error: string } {
  const text = typeof value === "string" ? value.trim() : "";
  if (text.length < min || text.length > max) return { error: `${label} ${min}–${max} karakter.` };
  return text;
}

export function parseRegister(body: unknown): { ok: true; value: RegisterInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Data pendaftaran tidak lengkap." };
  const raw = body as Record<string, unknown>;
  const name = readText(raw.name, "Nama lengkap", 2, 120);
  if (typeof name !== "string") return { ok: false, error: name.error };
  const username = typeof raw.username === "string" ? raw.username.trim().toLowerCase() : "";
  const usernameProblem = usernameError(username);
  if (usernameProblem) return { ok: false, error: usernameProblem };
  const email = typeof raw.email === "string" ? raw.email.trim().toLowerCase() : "";
  const emailProblem = emailError(email);
  if (emailProblem) return { ok: false, error: emailProblem };
  const organization = readText(raw.organization, "Satuan atau instansi", 2, 120);
  if (typeof organization !== "string") return { ok: false, error: organization.error };
  const position = readText(raw.position, "Pangkat atau jabatan", 2, 120);
  if (typeof position !== "string") return { ok: false, error: position.error };
  const password = typeof raw.password === "string" ? raw.password : "";
  const passwordRefusal = passwordError(password, username);
  if (passwordRefusal) return { ok: false, error: passwordRefusal };
  const confirm = typeof raw.confirmPassword === "string" ? raw.confirmPassword : "";
  if (!confirm) return { ok: false, error: "Konfirmasi kata sandi wajib diisi." };
  if (confirm !== password) return { ok: false, error: "Konfirmasi kata sandi tidak sama." };
  return { ok: true, value: { name, username, email, organization, position, password } };
}
