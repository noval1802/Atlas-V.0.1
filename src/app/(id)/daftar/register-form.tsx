"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { authButton, authField } from "@/components/ops/auth-frame";
import { PasswordField } from "@/components/ops/password-field";

const USERNAME = /^[a-z0-9][a-z0-9._-]{2,31}$/;

export function RegisterForm() {
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setMessage("");
    const form = new FormData(event.currentTarget);
    const username = String(form.get("username") ?? "").trim().toLowerCase();
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");
    if (!USERNAME.test(username)) {
      setError("Nama pengguna 3–32 karakter: huruf kecil, angka, titik, garis bawah, atau strip.");
      return;
    }
    if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email)) {
      setError("Email tidak valid.");
      return;
    }
    if (password.length < 10 || password.length > 200) {
      setError("Kata sandi minimal 10 karakter.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Konfirmasi kata sandi tidak sama.");
      return;
    }
    setBusy(true);
    let response: Response;
    try {
      response = await fetch("/api/ops/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          username,
          email,
          organization: form.get("organization"),
          position: form.get("position"),
          password,
          confirmPassword,
        }),
      });
    } catch {
      setBusy(false);
      setError("Jaringan bermasalah. Coba lagi.");
      return;
    }
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setError(typeof data.error === "string" ? data.error : "Pendaftaran gagal.");
      return;
    }
    setMessage(typeof data.message === "string" ? data.message : "Pendaftaran diterima. Akun menunggu persetujuan Admin.");
  }

  if (message) {
    return (
      <div className="space-y-4" role="status">
        <p className="text-sm text-white">{message}</p>
        <p className="text-sm text-white/70">Anda belum masuk. Dasbor operasional terbuka setelah Admin menyetujui akun.</p>
        <Link className={`${authButton} inline-block text-center`} href="/masuk">
          Kembali ke masuk
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} aria-busy={busy} className="space-y-4">
      <label className="block text-sm" htmlFor="name">
        Nama lengkap
        <input id="name" name="name" autoComplete="name" required minLength={2} maxLength={120} className={authField} />
      </label>
      <label className="block text-sm" htmlFor="username">
        Nama pengguna
        <input id="username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required className={authField} />
      </label>
      <label className="block text-sm" htmlFor="email">
        Email
        <input id="email" name="email" type="email" autoComplete="email" required className={authField} />
      </label>
      <label className="block text-sm" htmlFor="organization">
        Satuan atau instansi
        <input id="organization" name="organization" autoComplete="organization" required minLength={2} maxLength={120} className={authField} />
      </label>
      <label className="block text-sm" htmlFor="position">
        Pangkat atau jabatan
        <input id="position" name="position" autoComplete="organization-title" required minLength={2} maxLength={120} className={authField} />
      </label>
      <PasswordField name="password" label="Kata sandi" autoComplete="new-password" />
      <PasswordField name="confirmPassword" label="Konfirmasi kata sandi" autoComplete="new-password" />
      {error && (
        <p role="alert" className="text-sm text-rose-200">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className={authButton}>
        {busy ? "Mengirim..." : "Daftar"}
      </button>
      <p className="text-sm">
        <Link className="text-[var(--cyan-primary)] underline-offset-2 hover:underline" href="/masuk">
          Sudah punya akun
        </Link>
      </p>
    </form>
  );
}
