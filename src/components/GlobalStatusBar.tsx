'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { formatWib } from '@/lib/map-popup';
import { formatAge, statusTitle, type SourceState, type SourceStatus } from '@/lib/source-status';

const STATE_COLOR: Record<SourceState, string> = {
  ok: '#00E676',
  lambat: '#FFC400',
  gagal: '#FF5252',
  nonaktif: 'rgba(255,255,255,0.25)',
};

/** Per-source freshness, polled from /api/sources. `offline` once the server itself stops answering. */
function useSourceStatus() {
  const [report, setReport] = useState<{ sources: SourceStatus[]; skew: number } | null>(null);
  const [offline, setOffline] = useState(false);
  const [clock, setClock] = useState(() => Date.now());

  useEffect(() => {
    let live = true;
    const poll = async () => {
      try {
        const res = await fetch('/api/sources', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = await res.json() as { now: number; sources: SourceStatus[] };
        // Ages are measured on the server clock, so a wrong PC clock cannot make old data look new.
        if (live) { setReport({ sources: body.sources, skew: body.now - Date.now() }); setOffline(false); }
      } catch {
        if (live) setOffline(true);
      }
    };
    poll();
    const iv = setInterval(poll, 60_000);
    const tick = setInterval(() => setClock(Date.now()), 30_000);
    return () => { live = false; clearInterval(iv); clearInterval(tick); };
  }, []);

  return { sources: report?.sources ?? [], now: clock + (report?.skew ?? 0), offline };
}

interface Earthquake { id: string; magnitude: number; place: string; time: number; depth: number; }

/** `revealed` is false while the splash is up; the bar rises when it turns true. */
export default function GlobalStatusBar({ revealed = true }: { revealed?: boolean }) {
  const [quakes, setQuakes] = useState<Earthquake[]>([]);
  const [hoveredQuake, setHoveredQuake] = useState<Earthquake | null>(null);
  const status = useSourceStatus();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [quakeRes] = await Promise.allSettled([fetch('/api/earthquakes')]);

        if (quakeRes.status === 'fulfilled' && quakeRes.value.ok) {
          const quakeData = await quakeRes.value.json();
          const majorQuakes = (quakeData.earthquakes || [])
            .filter((q: Earthquake) => q.magnitude >= 4.0)
            .sort((a: Earthquake, b: Earthquake) => b.time - a.time)
            .slice(0, 5);
          setQuakes(majorQuakes);
        }
      } catch (e) { console.warn('[ATLAS] Suppressed error:', e instanceof Error ? e.message : e); }
    };
    fetchData();
    const iv = setInterval(fetchData, 60000);
    return () => clearInterval(iv);
  }, []);

  const hasTicker = quakes.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={revealed ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
      transition={{ delay: 0.5, duration: 0.6 }}
      className="hidden md:block absolute bottom-0 left-0 right-0 z-[210] pointer-events-none"
    >
      <div className="h-[28px] overflow-hidden bg-[#0a0a0f]/95 border-t border-white/[0.06] flex items-center text-[10px] font-mono tracking-wider backdrop-blur-xl relative">
        {/* Animated scan line */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[var(--cyan-primary)]/30 to-transparent" style={{ animation: 'hud-scanline 4s linear infinite' }} />
        
        {/* ── CENTER: Scrolling ticker ── */}
        <div className="flex-1 overflow-hidden relative" style={{ maskImage: 'linear-gradient(to right, transparent, black 3%, black 97%, transparent)' }}>
          <div className={`flex items-center animate-ticker whitespace-nowrap ${hasTicker ? '' : 'hidden'}`}>
            {[...Array(4)].map((_, repeatIdx) => (
              <span key={repeatIdx} className="inline-flex items-center">
                {/* Earthquakes */}
                {quakes.map(quake => (
                  <span 
                    key={`${quake.id}-${repeatIdx}`}
                    className="inline-flex items-center gap-1 mx-2 cursor-help pointer-events-auto"
                    onMouseEnter={() => setHoveredQuake(quake)}
                    onMouseLeave={() => setHoveredQuake(null)}
                  >
                    <span className="text-[#FF5722] text-[9px]">🔴</span>
                    <span className="text-[#FF5722] font-bold">M{quake.magnitude.toFixed(1)}</span>
                    <span className="text-white/30 truncate max-w-[140px]">{quake.place}</span>
                  </span>
                ))}
                <span className="text-white/10 mx-2">│</span>
              </span>
            ))}
          </div>
        </div>

        {/* ── RIGHT: Status ── */}
        <div className="flex-shrink-0 h-full flex items-center pointer-events-auto border-l border-white/[0.04]">

          {/* Source freshness: when each upstream last answered, not when we last asked. */}
          {status.offline ? (
            <div className="h-full px-3 flex items-center gap-1.5" role="status">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: STATE_COLOR.gagal }} />
              <span className="text-[9px] tracking-[0.2em]" style={{ color: STATE_COLOR.gagal }}>SERVER TERPUTUS</span>
            </div>
          ) : (
            <ul className="h-full flex items-center" aria-label="Status sumber data">
              {status.sources.map(s => (
                <li key={s.id} title={statusTitle(s, status.now, formatWib)} className="h-full px-2 flex items-center gap-1.5 cursor-help border-l border-white/[0.04]">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATE_COLOR[s.state] }} aria-hidden />
                  <span className="text-[9px] tracking-[0.15em] uppercase text-white/50">{s.label}</span>
                  <span className="text-[9px] tabular-nums" style={{ color: STATE_COLOR[s.state] }}>
                    {s.state === 'gagal' ? 'GAGAL' : s.state === 'nonaktif' ? '—' : s.badge ?? (s.fetchedAt !== null ? formatAge(status.now - s.fetchedAt) : '?')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Earthquake hover tooltip */}
      {hoveredQuake && (
        <div className="absolute bottom-[34px] left-1/2 -translate-x-1/2 z-[300] pointer-events-none">
          <div className="bg-black/90 backdrop-blur-xl border border-white/[0.08] rounded-lg px-4 py-3 text-[11px] font-mono whitespace-nowrap shadow-2xl">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px]">🔴</span>
              <span className="font-bold text-[#FF5722]">Magnitude {hoveredQuake.magnitude.toFixed(1)}</span>
              <span className="text-white/30 text-[9px] bg-white/5 px-1.5 py-0.5 rounded">BMKG</span>
            </div>
            <div className="text-[10px] text-white font-bold mb-2">
              {hoveredQuake.place}
            </div>
            <div className="flex flex-col gap-1 text-[10px]">
              <div className="text-white/50"><span className="text-white/30">Depth:</span> {hoveredQuake.depth} km</div>
              <div className="text-white/50 mt-1"><span className="text-white/30">Time:</span> {new Date(hoveredQuake.time).toLocaleString()}</div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
