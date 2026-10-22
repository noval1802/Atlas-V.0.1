"use client";

import { useEffect, useState } from "react";

type Zone = { zone: string; offset: number; lng: number; left: string };

/** HH.MM in a fixed UTC offset, Indonesian style. */
export function zoneTime(now: Date, offset: number): string {
  const shifted = new Date(now.getTime() + offset * 3_600_000);
  return `${String(shifted.getUTCHours()).padStart(2, "0")}.${String(shifted.getUTCMinutes()).padStart(2, "0")}`;
}

/** Live clocks under the WIB, WITA and WIT meridians. Empty until mounted so server and client markup agree. */
export function ZoneClocks({ zones }: { zones: Zone[] }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = window.setInterval(tick, 15_000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="auth-clocks pointer-events-none absolute inset-x-0 top-full mt-3 h-14">
      {zones.map((zone) => (
        <p key={zone.zone} className="absolute -translate-x-1/2 text-center" style={{ left: zone.left }}>
          <time className="auth-clock block text-xl text-[var(--auth-sand)] sm:text-2xl" suppressHydrationWarning>
            {now ? zoneTime(now, zone.offset) : "--.--"}
          </time>
          <span className="block text-xs text-[var(--auth-mist)]">
            {zone.zone} <span className="hidden sm:inline">{zone.lng}° BT</span>
          </span>
        </p>
      ))}
    </div>
  );
}
