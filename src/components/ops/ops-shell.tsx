import Link from "next/link";
import { canManageUsers } from "@/lib/ops/access";

export function OpsShell({
  title,
  subtitle,
  role,
  children,
}: {
  title: string;
  subtitle: string;
  role?: string;
  children: React.ReactNode;
}) {
  const showUsers = role ? canManageUsers(role) : true;
  return (
    <div className="ops-scroll min-h-screen bg-[#07070b] text-white">
      <header className="border-b border-white/10 bg-black/40">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <p className="text-[10px] font-bold tracking-[0.22em] text-[var(--gold-primary)]">ATLAS OPERASIONAL</p>
            <h1 className="mt-1 text-xl font-semibold">{title}</h1>
            <p className="mt-1 text-sm text-white/60">{subtitle}</p>
          </div>
          <nav className="flex flex-wrap gap-2 text-[11px] font-bold tracking-wider">
            <Link className="rounded border border-white/15 px-3 py-2 text-white/80 hover:bg-white/5" href="/peta">
              PETA
            </Link>
            <Link className="rounded border border-white/15 px-3 py-2 text-white/80 hover:bg-white/5" href="/operator">
              OPERATOR
            </Link>
            {showUsers && (
              <Link className="rounded border border-white/15 px-3 py-2 text-white/80 hover:bg-white/5" href="/pengguna">
                PENGGUNA
              </Link>
            )}
            {!role && (
              <Link className="rounded border border-white/15 px-3 py-2 text-white/80 hover:bg-white/5" href="/masuk">
                MASUK
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
