"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Eye, EyeOff, X } from "lucide-react";
import { ROLE_LABEL, STATUS_LABEL, type AccountStatus } from "./user-board-logic";

/** Field look without a width, so filter controls can size to their content. */
export const fieldBase =
  "h-10 rounded-md border border-[rgba(var(--cyan-rgb),0.22)] bg-black/30 px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/70 disabled:cursor-not-allowed disabled:opacity-50";
export const fieldClass = `${fieldBase} w-full`;

export const labelClass = "grid gap-1.5 text-[13px] font-medium text-[var(--text-secondary)]";

export function Panel({ id, tone = "cyan", className = "", children }: { id?: string; tone?: "cyan" | "gold"; className?: string; children: ReactNode }) {
  const edge =
    tone === "gold"
      ? "border-[rgba(var(--gold-rgb),0.45)] shadow-[0_0_28px_-12px_rgba(var(--gold-rgb),0.55)]"
      : "border-[rgba(var(--cyan-rgb),0.16)]";
  return (
    <section id={id} className={`scroll-mt-6 rounded-xl border ${edge} bg-[linear-gradient(180deg,rgba(var(--cyan-rgb),0.035),transparent_45%),var(--bg-panel)] ${className}`}>
      {children}
    </section>
  );
}

export function PanelTitle({ icon, title, count, children }: { icon: ReactNode; title: string; count?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
      <h2 className="flex items-center gap-3 text-[17px] font-semibold text-[var(--text-heading)]">
        <span className="text-[var(--gold-primary)]" aria-hidden="true">{icon}</span>
        {title}
        {count && <span className="font-normal text-[var(--text-muted)]">{count}</span>}
      </h2>
      {children && <div className="grid w-full gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">{children}</div>}
    </div>
  );
}

const ROLE_TONE: Record<string, string> = {
  SUPER_ADMIN: "border-[rgba(var(--gold-rgb),0.6)] bg-[rgba(var(--gold-rgb),0.12)] text-[var(--gold-light)]",
  ADMIN: "border-[rgba(var(--cyan-rgb),0.55)] bg-[rgba(var(--cyan-rgb),0.1)] text-[var(--cyan-primary)]",
  OPERATOR_PUSDALOPS: "border-emerald-400/50 bg-emerald-400/10 text-emerald-300",
  OPERATOR_KODAM: "border-sky-400/50 bg-sky-400/10 text-sky-300",
  ANALYST: "border-violet-400/50 bg-violet-400/10 text-violet-300",
  PIMPINAN: "border-orange-400/50 bg-orange-400/10 text-orange-300",
};

export function RoleBadge({ role }: { role: string }) {
  return (
    <span title={ROLE_LABEL[role] ?? role} className={`inline-flex rounded border px-2 py-1 font-mono text-[11px] font-semibold tracking-wide ${ROLE_TONE[role] ?? "border-white/20 text-white/70"}`}>
      {role}
    </span>
  );
}

const STATUS_TONE: Record<AccountStatus, string> = {
  ACTIVE: "border-emerald-400/45 bg-emerald-400/10 text-emerald-300",
  PENDING: "border-amber-400/50 bg-amber-400/10 text-amber-300",
  REJECTED: "border-rose-400/50 bg-rose-400/10 text-rose-300",
  DISABLED: "border-white/20 bg-white/5 text-[var(--text-muted)]",
};

export function StatusBadge({ status }: { status: AccountStatus }) {
  return <span className={`inline-flex rounded border px-2 py-1 text-xs font-semibold ${STATUS_TONE[status]}`}>{STATUS_LABEL[status]}</span>;
}

export function Avatar({ text }: { text: string }) {
  return (
    <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[rgba(var(--cyan-rgb),0.25)] bg-[radial-gradient(circle_at_30%_30%,#2a3a5c,#141c2e)] text-sm font-semibold text-[var(--text-heading)]">
      {text}
    </span>
  );
}

export function PasswordInput({ name, value, onChange, placeholder, label }: { name: string; value: string; onChange: (value: string) => void; placeholder: string; label: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="relative block">
      <input
        name={name}
        type={visible ? "text" : "password"}
        autoComplete="new-password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className={`${fieldClass} pr-11`}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? `Sembunyikan ${label.toLowerCase()}` : `Tampilkan ${label.toLowerCase()}`}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 grid w-10 place-items-center text-[var(--text-muted)] hover:text-[var(--text-primary)]"
      >
        {visible ? <Eye className="h-4 w-4" aria-hidden="true" /> : <EyeOff className="h-4 w-4" aria-hidden="true" />}
      </button>
    </span>
  );
}

/** Modal with Escape to close, focus moved in on open and back to the opener on close. */
export function Modal({ title, onClose, children, width = "max-w-lg" }: { title: string; onClose: () => void; children: ReactNode; width?: string }) {
  const panel = useRef<HTMLDivElement>(null);
  // Parents pass a fresh closure each render; reading it through a ref keeps focus from jumping.
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>("input, select, textarea, button:not([data-close])")?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close.current();
    };
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("keydown", escape);
      opener?.focus?.();
    };
  }, []);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-4 backdrop-blur-sm" onPointerDown={(event) => event.target === event.currentTarget && close.current()}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`ops-fade max-h-[90vh] w-full ${width} overflow-y-auto rounded-xl border border-[rgba(var(--cyan-rgb),0.3)] bg-[var(--bg-secondary)] shadow-[0_24px_60px_rgba(0,0,0,0.6)]`}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 className="text-base font-semibold text-[var(--text-heading)]">{title}</h2>
          <button type="button" data-close onClick={onClose} aria-label="Tutup" className="grid h-9 w-9 place-items-center rounded text-[var(--text-muted)] hover:bg-white/5 hover:text-[var(--text-primary)]">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export type Confirmation = { title: string; lines: string[]; action: string; danger?: boolean; run: () => Promise<void> };

export function ConfirmDialog({ confirmation, busy, onClose }: { confirmation: Confirmation; busy: boolean; onClose: () => void }) {
  return (
    <Modal title={confirmation.title} onClose={busy ? () => {} : onClose} width="max-w-md">
      <ul className="space-y-2 text-sm text-[var(--text-primary)]">
        {confirmation.lines.map((line) => (
          <li key={line} className="flex gap-2">
            <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--gold-primary)]" />
            {line}
          </li>
        ))}
      </ul>
      <div className="mt-6 flex justify-end gap-2">
        <button type="button" onClick={onClose} disabled={busy} className="h-10 rounded-md border border-white/20 px-4 text-sm font-semibold text-[var(--text-primary)] hover:bg-white/5 disabled:opacity-50">
          Batal
        </button>
        <button
          type="button"
          onClick={() => void confirmation.run()}
          disabled={busy}
          className={`h-10 rounded-md px-4 text-sm font-bold disabled:cursor-wait disabled:opacity-60 ${confirmation.danger ? "bg-rose-500 text-white hover:bg-rose-400" : "bg-[var(--gold-primary)] text-[#1a1404] hover:brightness-110"}`}
        >
          {busy ? "Memproses…" : confirmation.action}
        </button>
      </div>
    </Modal>
  );
}
