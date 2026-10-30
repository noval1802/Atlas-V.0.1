"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { authButton, authLink } from "@/components/ops/auth-frame";
import { PasswordField } from "@/components/ops/password-field";

export function ResetForm() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");
    if (password !== confirmPassword) {
      setError("Konfirmasi kata sandi tidak sama.");
      return;
    }
    setBusy(true);
    let response: Response;
    try {
      response = await fetch("/api/ops/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirmPassword }),
      });
    } catch {
      setBusy(false);
      setError("Jaringan bermasalah. Coba lagi.");
      return;
    }
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setError(typeof data.error === "string" ? data.error : "Reset gagal.");
      return;
    }
    setMessage(typeof data.message === "string" ? data.message : "Kata sandi diperbarui.");
  }

  if (!token) {
    return (
      <p role="alert" className="ops-fade rounded-md border-l-[3px] border-[var(--auth-signal)] bg-[rgba(255,90,79,0.1)] px-3.5 py-2.5 text-sm text-[#ffd9d6]">
        Tautan reset tidak lengkap.{" "}
        <Link className={authLink} href="/lupa-sandi">
          Minta tautan baru
        </Link>
      </p>
    );
  }

  if (message) {
    return (
      <div className="space-y-4" role="status">
        <p className="text-sm text-white">{message}</p>
        <Link className={`${authButton} inline-block text-center`} href="/masuk">
          Masuk
        </Link>
      </div>
    );
  }

  return (
    <form method="post" onSubmit={onSubmit} aria-busy={busy} className="space-y-4">
      <PasswordField name="password" label="Kata sandi baru" autoComplete="new-password" />
      <PasswordField name="confirmPassword" label="Konfirmasi kata sandi baru" autoComplete="new-password" />
      {error && (
        <p role="alert" className="ops-fade rounded-md border-l-[3px] border-[var(--auth-signal)] bg-[rgba(255,90,79,0.1)] px-3.5 py-2.5 text-sm text-[#ffd9d6]">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className={authButton}>
        {busy ? "Menyimpan..." : "Simpan kata sandi"}
      </button>
    </form>
  );
}
