import type { ReactNode } from "react";
import { ParticleBackground } from "./ParticleBackground";

export const authField =
  "mt-1 w-full rounded border border-[var(--control-border)] bg-[#071422]/80 px-3 py-2 text-sm text-white outline-none focus:border-[var(--cyan-primary)]";

export const authButton =
  "w-full rounded bg-[#e8eef5] px-3 py-2 text-sm font-bold text-[#06101c] disabled:opacity-60";

export function AuthFrame({
  title,
  subtitle,
  children,
  backdrop = "map",
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  backdrop?: "map" | "particles";
}) {
  const particles = backdrop === "particles";
  return (
    <div className={`ops-scroll relative min-h-screen text-[#e8eef5] ${particles ? "bg-[#030712]" : "bg-[#06101c]"}`}>
      {particles ? (
        <ParticleBackground />
      ) : (
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <IndonesiaBackdrop />
        </div>
      )}
      <main className="ops-auth-main relative z-10 mx-auto flex w-full max-w-lg flex-col px-4 py-8">
        <div className="rounded-xl border border-white/15 bg-[#071422]/90 p-5 shadow-2xl backdrop-blur-sm sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <div
              role="img"
              aria-label="ATLAS — Advanced Tactical Location & Analytics System"
              className="h-11 w-11 shrink-0 bg-contain bg-center bg-no-repeat"
              style={{ backgroundImage: "url(/eye-of-horus.svg)" }}
            />
            <div>
              <p className="font-[family-name:var(--font-hud)] text-[10px] font-bold tracking-[0.28em] text-[var(--cyan-primary)]">ATLAS</p>
              <p className="text-sm text-white/80">Sistem monitoring</p>
            </div>
          </div>
          <h1 className="text-2xl font-semibold text-white">{title}</h1>
          <p className="mt-1 text-sm text-white/70">{subtitle}</p>
          <div className="mt-5">{children}</div>
        </div>
      </main>
    </div>
  );
}

function IndonesiaBackdrop() {
  return (
    <svg className="h-full w-full" viewBox="0 0 640 360" preserveAspectRatio="xMidYMid slice">
      <defs>
        <pattern id="osiris-auth-grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(0,229,255,0.09)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="640" height="360" fill="#071422" />
      <rect width="640" height="360" fill="url(#osiris-auth-grid)" />
      <g fill="rgba(186,214,230,0.18)" stroke="rgba(0,229,255,0.38)" strokeWidth="1.2">
        <path d="M86 70c-18 28-22 78-8 128 10 36 28 62 40 58 8-28 4-70-6-110 14-22 18-48 6-70-10-6-22-8-32-6z" />
        <path d="M168 232c36-10 92-6 148 8 18 4 16 18-8 22-48 8-110 6-140-6-14-6-16-16 0-24z" />
        <path d="M214 78c28-18 78-16 108 8 22 18 20 48-4 70-28 24-70 28-104 10-20-12-24-40 0-88z" />
        <path d="M392 118c18-24 28-20 36 4 10 28 4 62-16 84-16 16-28 8-30-12-2-28 0-52 10-76z" />
        <path d="M430 168c16 8 22 28 10 46-8 12-20 10-24-4-4-16 2-32 14-42z" />
        <path d="M500 150c34-16 78-8 96 18 14 20 8 40-16 52-30 16-70 8-90-16-12-16-8-40 10-54z" />
      </g>
      <g fill="rgba(232,238,245,0.55)" fontSize="11" fontFamily="ui-monospace, monospace">
        <text x="18" y="28">6°N</text>
        <text x="18" y="168">0°</text>
        <text x="18" y="292">8°S</text>
        <text x="86" y="344">95°E</text>
        <text x="286" y="344">115°E</text>
        <text x="500" y="344">135°E</text>
      </g>
    </svg>
  );
}
