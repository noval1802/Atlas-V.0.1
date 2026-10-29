import type { CSSProperties, ReactNode } from "react";
import { Archivo } from "next/font/google";
import { NEIGHBOUR_COAST, NKRI_ISLANDS, NKRI_VIEW } from "./nkri-outline";
import { ZoneClocks } from "./zone-clocks";
import { AuthPointer } from "./auth-pointer";

/* Self-hosted at build time, so the sign-in pages also render on a closed network. */
const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-auth", display: "swap" });

export const authField =
  "mt-1 block min-h-12 w-full rounded-md border short:min-h-11 border-[rgba(var(--auth-accent-rgb),0.35)] bg-[rgba(0,0,0,0.35)] px-3.5 text-[15px] text-[var(--auth-sand)] placeholder:text-[var(--auth-mist)] outline-none transition-[border-color,box-shadow] focus:border-[var(--auth-accent)] focus:shadow-[0_0_0_3px_rgba(var(--auth-accent-rgb),0.18)]";

export const authButton =
  "auth-label auth-sheen relative overflow-hidden min-h-12 short:min-h-11 w-full rounded-md bg-[linear-gradient(180deg,color-mix(in_srgb,var(--gold-primary)_70%,white),var(--gold-primary))] px-4 text-[14px] tracking-[0.3em] text-[#1a1404] shadow-[0_0_24px_-6px_rgba(var(--gold-rgb),0.6)] transition-[filter,transform] hover:brightness-110 active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold-primary)] disabled:cursor-wait disabled:opacity-70";

export const authLink = "text-[var(--auth-accent)] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--auth-accent)]";

const ZONES = [
  { zone: "WIB", offset: 7 },
  { zone: "WITA", offset: 8 },
  { zone: "WIT", offset: 9 },
] as const;

const xOf = (lng: number) => (lng - NKRI_VIEW.lon0) * NKRI_VIEW.scale;
const yOf = (lat: number) => (NKRI_VIEW.lat0 - lat) * NKRI_VIEW.scale;

/** Entrance order: each step rises 90 ms after the one before. */
const step = (n: number) => ({ "--d": `${n * 90}ms` }) as CSSProperties;

export function AuthFrame({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className={`${archivo.variable} auth-root ops-scroll relative flex min-h-[100svh] flex-col overflow-hidden`}>
      <AuthPointer />
      {/* The archipelago as a faint watermark behind the form, drifting with the pointer. */}
      <div className="auth-parallax pointer-events-none absolute inset-0" aria-hidden="true">
        <svg viewBox={`0 0 ${NKRI_VIEW.width} ${NKRI_VIEW.height}`} className="auth-backdrop absolute left-1/2 top-[55%] w-[260vw] -translate-x-1/2 -translate-y-1/2 sm:top-1/2 sm:w-[min(140vw,1600px)]">
          <g className="auth-graticule">
            {[95, 100, 105, 110, 115, 120, 125, 130, 135, 140].map((lng) => (
              <line key={lng} x1={xOf(lng)} x2={xOf(lng)} y1={0} y2={NKRI_VIEW.height} />
            ))}
            {[5, 0, -5, -10].map((lat) => (
              <line key={lat} x1={0} x2={NKRI_VIEW.width} y1={yOf(lat)} y2={yOf(lat)} className={lat === 0 ? "auth-equator" : undefined} />
            ))}
          </g>
          <path d={NEIGHBOUR_COAST} className="auth-neighbour" />
          <g className="auth-islands">
            {NKRI_ISLANDS.map((island, index) => (
              <path key={index} d={island.d} pathLength={1} style={{ "--i": index } as CSSProperties} />
            ))}
          </g>
        </svg>
        <div className="auth-scan" />
      </div>
      <header className="auth-label auth-rise relative flex justify-between gap-4 border-b border-[var(--auth-line)] px-4 py-3 text-[11px] sm:px-10" style={step(0)}>
        <span className="flex items-center gap-2 text-[var(--auth-accent)]">
          <span aria-hidden="true" className="auth-live h-1.5 w-1.5 rounded-full bg-[var(--auth-accent)]" />
          Terbatas · Pusdalops TNI
        </span>
        <span className="hidden text-[var(--auth-mist)] sm:inline">Hanya melalui jaringan resmi</span>
      </header>

      <main className="relative flex flex-1 flex-col items-center px-4 py-[clamp(1.5rem,6vh,4rem)] short:py-3">
        <div className="auth-rise flex max-w-full items-center gap-4" style={step(1)}>
          <span aria-hidden="true" className="auth-reticle relative grid h-16 w-16 short:h-12 short:w-12 shrink-0 place-items-center">
            <svg viewBox="0 0 64 64" className="absolute inset-0 h-full w-full">
              <circle cx="32" cy="32" r="30" className="auth-reticle-ring" />
              <circle cx="32" cy="32" r="24" className="auth-reticle-dots" />
              <circle cx="32" cy="32" r="30" pathLength={100} className="auth-reticle-arc" />
              <path d="M32 0v5M32 59v5M0 32h5M59 32h5" className="auth-reticle-ticks" />
            </svg>
            <span className="auth-logo h-7 w-9" />
          </span>
          <span className="min-w-0">
            <span className="auth-wordmark block text-2xl leading-none text-[var(--auth-sand)]">ATLAS</span>
            <span className="auth-label mt-1.5 block text-[10px] text-[var(--auth-mist)]">Pusat Pengendalian Operasi TNI</span>
          </span>
        </div>

        <p className="auth-label auth-rise mt-[clamp(1.5rem,5vh,2.5rem)] flex items-center gap-3 short:hidden text-[11px] text-[var(--auth-accent)]" style={step(2)}>
          <span aria-hidden="true" className="auth-rule h-px w-10 bg-[var(--auth-accent)]" />
          Peta Operasi
        </p>
        <h1 className="auth-display mt-4 short:mt-3 text-center text-[clamp(1.25rem,min(5.4vw,7vh),2.5rem)] text-[var(--auth-sand)]">
          <span className="auth-line" style={step(3)}><span>{title}</span></span>
          <span className="auth-line auth-glow text-[var(--auth-accent)]" style={step(4)}><span>Peta Operasi</span></span>
        </h1>
        <p className="auth-rise mt-4 short:mt-1.5 max-w-md text-center text-[15px] leading-relaxed text-[var(--auth-mist)]" style={step(5)}>{subtitle}</p>

        <div className="auth-rise mt-[clamp(1.5rem,5vh,2.5rem)] short:mt-4 w-full max-w-md" style={step(6)}>
          <div className="auth-panel relative p-6 sm:p-8 short:py-5">{children}</div>
        </div>

        <footer className="auth-label auth-rise mt-8 short:mt-3 flex w-full max-w-md flex-wrap justify-between gap-2 border-t border-[var(--auth-line)] pt-4 text-[10px] text-[var(--auth-mist)]" style={step(7)}>
          <span>Atlas · Pusdalops TNI</span>
          <ZoneClocks zones={ZONES} />
        </footer>
      </main>
    </div>
  );
}
