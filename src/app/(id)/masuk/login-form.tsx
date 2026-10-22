"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { authButton, authField, authLink } from "@/components/ops/auth-frame";
import { acceptedNext } from "@/lib/ops/access";
import { PasswordField } from "@/components/ops/password-field";

export function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    const form = new FormData(event.currentTarget);
    const username = String(form.get("username") ?? "").trim();
    const password = String(form.get("password") ?? "");
    if (!username || !password) {
      setError("Nama pengguna dan kata sandi wajib diisi.");
      return;
    }
    setBusy(true);
    let response: Response;
    try {
      response = await fetch("/api/ops/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, remember: form.get("remember") === "on" }),
      });
    } catch {
      setBusy(false);
      setError("Jaringan bermasalah. Coba lagi.");
      return;
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setBusy(false);
      setError(typeof data.error === "string" ? data.error : "Masuk gagal.");
      return;
    }
    const home = typeof data.home === "string" ? data.home : "/operator";
    const allowed = Array.isArray(data.allowed) ? data.allowed.filter((item: unknown) => typeof item === "string") : [];
    window.location.assign(next ? acceptedNext(next, allowed) ?? home : home);
  }

  return (
    <form onSubmit={onSubmit} aria-busy={busy} className="space-y-5" noValidate={false}>
      <label className="block text-sm text-[var(--auth-sand)]" htmlFor="username">
        Nama pengguna
        <input
          id="username"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          className={authField}
        />
      </label>
      <PasswordField name="password" label="Kata sandi" autoComplete="current-password" minLength={1} />
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-[var(--auth-sand)]">
        <input name="remember" type="checkbox" className="h-[18px] w-[18px] accent-[var(--gold-primary)]" />
        Ingat saya di perangkat ini
      </label>
      {error && (
        <p role="alert" className="ops-fade rounded-md border-l-[3px] border-[var(--auth-signal)] bg-[rgba(255,90,79,0.1)] px-3.5 py-2.5 text-sm text-[#ffd9d6]">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className={authButton}>
        {busy ? "Memeriksa..." : "Masuk"}
      </button>
      <p className="flex flex-wrap justify-between gap-2 text-sm">
        <Link className={authLink} href="/lupa-sandi">
          Lupa kata sandi
        </Link>
        <Link className="text-[var(--auth-sand)] underline-offset-4 hover:underline" href="/daftar">
          Daftar akun
        </Link>
      </p>
      <p className="border-t border-[var(--auth-line)] pt-4 text-xs leading-relaxed text-[var(--auth-mist)]">
        Hanya untuk pengguna berwenang. Setiap upaya masuk dicatat.
      </p>
    </form>
  );
}
