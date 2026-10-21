"use client";

import { useId, useState } from "react";
import { authField } from "./auth-frame";

export function PasswordField({
  name,
  label,
  autoComplete,
  minLength = 10,
}: {
  name: string;
  label: string;
  autoComplete: string;
  minLength?: number;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <div className="block text-sm">
      <label htmlFor={id}>{label}</label>
      <div className="mt-1 flex gap-2">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          minLength={minLength}
          required
          className={`${authField} mt-0 min-w-0 flex-1`}
        />
        <button
          type="button"
          aria-pressed={visible}
          aria-label={visible ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
          onClick={() => setVisible((current) => !current)}
          className="rounded border border-[var(--control-border)] px-3 text-xs font-bold text-white/80 hover:border-[var(--cyan-primary)]"
        >
          {visible ? "Sembunyi" : "Lihat"}
        </button>
      </div>
    </div>
  );
}
