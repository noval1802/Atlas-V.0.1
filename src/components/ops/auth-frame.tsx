import type { CSSProperties, ReactNode } from "react";
import { Archivo } from "next/font/google";
import { NEIGHBOUR_COAST, NKRI_ISLANDS, NKRI_VIEW } from "./nkri-outline";
import { ZoneClocks } from "./zone-clocks";

/* Self-hosted at build time, so the sign-in pages also render on a closed network. */
const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-auth", display: "swap" });

export const authField =
  "mt-1 block min-h-12 w-full rounded-md border border-[var(--auth-line)] bg-[var(--auth-sea)] px-3.5 text-[15px] text-[var(--auth-sand)] placeholder:text-[var(--auth-mist)] outline-none transition-[border-color,box-shadow] focus:border-[var(--gold-primary)] focus:shadow-[0_0_0_3px_rgba(var(--gold-rgb),0.18)]";

export const authButton =
  "min-h-12 w-full rounded-md bg-[var(--gold-primary)] px-4 text-[15px] font-semibold text-[#1a1404] transition-[filter,transform] hover:brightness-110 active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold-primary)] disabled:cursor-wait disabled:opacity-70";

export const authLink = "text-[var(--gold-primary)] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold-primary)]";

/** Zone meridians of WIB, WITA and WIT, placed on the chart by longitude. */
const ZONES = [
  { lng: 105, zone: "WIB", offset: 7 },
  { lng: 120, zone: "WITA", offset: 8 },
  { lng: 135, zone: "WIT", offset: 9 },
] as const;

const xOf = (lng: number) => (lng - NKRI_VIEW.lon0) * NKRI_VIEW.scale;
const yOf = (lat: number) => (NKRI_VIEW.lat0 - lat) * NKRI_VIEW.scale;

export function AuthFrame({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className={`${archivo.variable} auth-root ops-scroll min-h-screen lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(400px,30rem)]`}>
      <section aria-label="Peta Operasi, Pusat Pengendalian Operasi TNI" className="relative flex flex-col overflow-hidden px-6 pb-6 pt-6 sm:px-10 lg:min-h-screen lg:px-14 lg:pb-12 lg:pt-12">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="auth-logo h-9 w-11 shrink-0" />
          <span className="auth-wordmark text-lg text-[var(--auth-sand)]">ATLAS</span>
        </div>

        <div className="mt-8 lg:mt-14">
          <p className="auth-display text-[clamp(2.25rem,6vw,5.25rem)] text-[var(--auth-sand)]">Peta Operasi</p>
          <p className="mt-3 max-w-md text-base text-[var(--auth-mist)] lg:text-lg">Pusat Pengendalian Operasi TNI</p>
        </div>

        <figure className="relative mb-16 mt-6 w-full lg:mt-auto" style={{ aspectRatio: `${NKRI_VIEW.width} / ${NKRI_VIEW.height}` }}>
          <svg viewBox={`0 0 ${NKRI_VIEW.width} ${NKRI_VIEW.height}`} className="absolute inset-0 h-full w-full" aria-hidden="true">
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
            {ZONES.map((zone) => (
              <line key={zone.zone} x1={xOf(zone.lng)} x2={xOf(zone.lng)} y1={0} y2={NKRI_VIEW.height} className="auth-meridian" />
            ))}
          </svg>
          <ZoneClocks zones={ZONES.map((zone) => ({ ...zone, left: `${(xOf(zone.lng) / NKRI_VIEW.width) * 100}%` }))} />
        </figure>
      </section>

      <main className="auth-panel relative flex flex-col justify-center px-6 py-10 sm:px-10 lg:min-h-screen lg:px-12">
        <div className="mx-auto w-full max-w-sm">
          <h1 className="auth-title text-3xl text-[var(--auth-sand)]">{title}</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-[var(--auth-mist)]">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  );
}
