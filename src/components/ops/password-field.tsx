"use client";

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
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
  const Icon = visible ? EyeOff : Eye;
  return (
    <div className="block text-sm">
      <label htmlFor={id} className="text-[var(--auth-sand)]">
        {label}
      </label>
      <div className="relative mt-1">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          minLength={minLength}
          required
          className={`${authField} mt-0 pr-12`}
        />
        <button
          type="button"
          aria-pressed={visible}
          aria-label={visible ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
          title={visible ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
          onClick={() => setVisible((current) => !current)}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-md text-[var(--auth-mist)] hover:text-[var(--auth-sand)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--auth-accent)]"
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
