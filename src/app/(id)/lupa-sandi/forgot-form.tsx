"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { authButton, authField } from "@/components/ops/auth-frame";

export function ForgotForm() {
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setMessage("");
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    if (!email) {
      setError("Email wajib diisi.");
      return;
    }
    setBusy(true);
    let response: Response;
    try {
      response = await fetch("/api/ops/password/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch {
      setBusy(false);
      setError("Jaringan bermasalah. Coba lagi.");
      return;
    }
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setError(typeof data.error === "string" ? data.error : "Permintaan gagal.");
      return;
    }
    setMessage(typeof data.message === "string" ? data.message : "Permintaan diterima.");
  }

  return (
    <form onSubmit={onSubmit} aria-busy={busy} className="space-y-4">
      <label className="block text-sm" htmlFor="email">
        Email terdaftar
        <input id="email" name="email" type="email" autoComplete="email" required className={authField} />
      </label>
      {error && (
        <p role="alert" className="text-sm text-rose-200">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm text-white">
          {message}
        </p>
      )}
      <button type="submit" disabled={busy} className={authButton}>
        {busy ? "Memeriksa..." : "Kirim tautan reset"}
      </button>
      <p className="text-sm">
        <Link className="text-[var(--cyan-primary)] underline-offset-2 hover:underline" href="/masuk">
          Kembali ke masuk
        </Link>
      </p>
    </form>
  );
}
