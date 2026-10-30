import Link from "next/link";
import { UserRound } from "lucide-react";
import { PortalMenu } from "@/components/ops/portal-menu";

export function OpsShell({
  title,
  subtitle,
  role,
  user,
  children,
}: {
  title: string;
  subtitle: string;
  role?: string;
  /** Signed-in identity shown in the header; omitted on public pages. */
  user?: { name: string; role: string };
  children: React.ReactNode;
}) {
  return (
    <div className="ops-scroll min-h-screen bg-[radial-gradient(ellipse_at_top,var(--bg-secondary)_0%,var(--bg-void)_55%)] text-[var(--text-primary)]">
      <header className="relative border-b border-[rgba(var(--cyan-rgb),0.12)] bg-[linear-gradient(90deg,rgba(var(--gold-rgb),0.06),transparent_35%),var(--bg-primary)]">
        {/* Clip only the decoration; clipping the header would hide the portal dropdown. */}
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <span className="absolute -left-6 top-0 h-full w-24 -skew-x-[30deg] border-r border-[rgba(var(--gold-rgb),0.45)]" />
        </span>
        <div className="relative mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-8">
          <div className="pl-6">
            <p className="text-[11px] font-bold tracking-[0.22em] text-[var(--gold-primary)]">ATLAS OPERASIONAL</p>
            <h1 className="mt-1 text-2xl font-semibold text-[var(--text-heading)]">{title}</h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">{subtitle}</p>
          </div>
          {role ? (
            <div className="flex w-full items-center justify-between gap-4 sm:w-auto sm:justify-start">
              {/* On phones the menu button sits at the right edge so its right-aligned dropdown stays on screen. */}
              <PortalMenu role={role} className="order-last sm:order-first" />
              {user && (
                <div className="flex items-center gap-3 border-white/10 sm:border-l sm:pl-4">
                  <span aria-hidden="true" className="grid h-11 w-11 place-items-center rounded-full border border-[var(--gold-primary)] text-[var(--gold-primary)]">
                    <UserRound className="h-5 w-5" />
                  </span>
                  <span className="leading-tight">
                    <span className="block text-sm font-semibold text-[var(--text-heading)]">{user.name}</span>
                    <span className="block font-mono text-[11px] font-semibold tracking-wide text-[var(--gold-primary)]">{user.role}</span>
                  </span>
                </div>
              )}
            </div>
          ) : (
            <Link className="rounded border border-white/15 px-3 py-2 text-[11px] font-bold tracking-wider text-white/80 hover:bg-white/5" href="/masuk">
              MASUK
            </Link>
          )}
        </div>
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,transparent,rgba(var(--gold-rgb),0.7)_20%,rgba(var(--cyan-rgb),0.8)_60%,rgba(var(--gold-rgb),0.6)_85%,transparent)]" />
      </header>
      <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-8">{children}</main>
    </div>
  );
}
