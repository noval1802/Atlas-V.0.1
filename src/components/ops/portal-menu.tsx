"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, LayoutGrid, LogOut, Map as MapIcon, Users } from "lucide-react";
import { portalLabel, portalLinks } from "@/lib/ops/access";

const icons = { "/peta": MapIcon, "/operator": LayoutDashboard, "/pengguna": Users } as const;

/** Ikon menu portal: halaman yang diizinkan peran (RBAC) plus Keluar. */
export function PortalMenu({ role, name, className = "" }: { role: string; name?: string; className?: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  async function logout() {
    setLeaving(true);
    await fetch("/api/ops/logout", { method: "POST" }).catch(() => undefined);
    window.location.assign("/masuk");
  }

  const item =
    "flex min-h-11 w-full items-center gap-3 rounded px-3 text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--gold-primary)]";

  return (
    <div ref={root} className={`relative pointer-events-auto font-sans tracking-normal ${className}`}>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="portal-menu"
        title="Menu portal"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded border border-[var(--control-border)] bg-black/60 text-[var(--text-heading)] backdrop-blur hover:border-[var(--gold-primary)] hover:text-[var(--gold-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold-primary)]"
      >
        <LayoutGrid className="h-5 w-5" aria-hidden="true" />
        <span className="sr-only">Menu portal</span>
      </button>
      {open && (
        <div
          id="portal-menu"
          role="menu"
          aria-label="Menu portal"
          className="ops-fade absolute right-0 top-full z-[400] mt-2 w-64 rounded-lg border border-[var(--control-border)] bg-[#0b0b12] p-2 text-[var(--text-heading)] shadow-2xl"
        >
          <p className="px-3 pb-2 pt-1 text-xs text-[var(--text-secondary)]">
            {name ? `${name} · ` : ""}
            {portalLabel(role)}
          </p>
          {portalLinks(role).map((link) => {
            const Icon = icons[link.href];
            const current = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                role="menuitem"
                aria-current={current ? "page" : undefined}
                onClick={() => setOpen(false)}
                className={`${item} ${current ? "bg-[var(--hover-accent)] text-[var(--gold-primary)]" : "hover:bg-white/5"}`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {link.label}
              </Link>
            );
          })}
          <div className="my-1 border-t border-white/10" />
          <button type="button" role="menuitem" disabled={leaving} onClick={() => void logout()} className={`${item} text-[var(--alert-red)] hover:bg-white/5 disabled:opacity-60`}>
            <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
            {leaving ? "Keluar..." : "Keluar"}
          </button>
        </div>
      )}
    </div>
  );
}
