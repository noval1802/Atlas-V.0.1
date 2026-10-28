"use client";

import { useEffect, useState } from "react";

type Zone = { zone: string; offset: number };

/** HH.MM in a fixed UTC offset, Indonesian style. */
export function zoneTime(now: Date, offset: number): string {
  const shifted = new Date(now.getTime() + offset * 3_600_000);
  return `${String(shifted.getUTCHours()).padStart(2, "0")}.${String(shifted.getUTCMinutes()).padStart(2, "0")}`;
}

/** Live WIB, WITA and WIT clocks in one row. Empty until mounted so server and client markup agree. */
export function ZoneClocks({ zones }: { zones: readonly Zone[] }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = window.setInterval(tick, 15_000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <span className="auth-clocks inline-flex gap-4">
      {zones.map((zone) => (
        <span key={zone.zone}>
          {zone.zone}{" "}
          <time className="auth-clock text-[var(--auth-sand)]" suppressHydrationWarning>
            {now ? zoneTime(now, zone.offset) : "--.--"}
          </time>
        </span>
      ))}
    </span>
  );
}
