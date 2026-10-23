'use client';

import { Cctv, ExternalLink, MapPin, Trash2, X } from 'lucide-react';
import type { WatchedCamera } from '@/lib/dashboard-state';
import { spaceCamKey, writeSpaceCams } from '@/lib/space-cams';

/**
 * ATLAS — SPACE: the CCTV this viewer picked from the map ("Pilih untuk SPACE"
 * in the camera viewer). The panel only lists them; they play in the
 * multiviewer, which opens in its own full-screen tab. Listing rather than
 * playing here means a chosen camera is never streamed twice.
 */

interface SpaceCamProps {
  cameras: WatchedCamera[];
  onRemove: (camera: WatchedCamera) => void;
  onLocate: (lat: number, lng: number) => void;
}

export default function SpaceCam({ cameras, onRemove, onLocate }: SpaceCamProps) {
  return (
    <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-panel)] backdrop-blur-2xl overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border-secondary)]/40">
        <Cctv className="w-3.5 h-3.5 text-[#00E5FF]" />
        <span className="text-[11px] font-mono font-bold tracking-widest text-[#00E5FF]">CCTV TERPILIH</span>
        <span className="ml-auto text-[9px] font-mono tracking-wider text-[var(--text-muted)]">{cameras.length} KAMERA</span>
        {cameras.length > 0 && (
          <button
            type="button"
            onClick={() => { if (window.confirm('Kosongkan semua CCTV terpilih?')) writeSpaceCams([]); }}
            title="Kosongkan daftar"
            aria-label="Kosongkan semua CCTV terpilih"
            className="ml-1 p-1 rounded hover:bg-white/10 text-[var(--text-muted)] hover:text-red-300 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>

      {cameras.length === 0 ? (
        <p className="px-3 py-4 text-[10px] font-mono leading-relaxed text-[var(--text-muted)]">
          Belum ada CCTV dipilih. Klik CCTV di peta, lalu tekan <span className="text-[#00E5FF]">PILIH UNTUK SPACE</span>.
        </p>
      ) : (
        <ul className="max-h-[50vh] overflow-y-auto styled-scrollbar py-1">
          {cameras.map((camera, index) => (
            <li key={spaceCamKey(camera)} className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/[0.04]">
              <span className="w-5 shrink-0 text-right text-[9px] font-mono text-[var(--text-muted)]">{index + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[10px] font-mono text-white">{camera.name || 'CCTV'}</p>
                <p className="truncate text-[9px] font-mono text-[var(--text-muted)]">{[camera.city, camera.source].filter(Boolean).join(' · ')}</p>
              </div>
              <button type="button" onClick={() => onLocate(camera.lat, camera.lng)} className="rounded p-1 text-white/60 hover:bg-white/10 hover:text-[var(--gold-primary)]" title="Terbang ke lokasi" aria-label={`Terbang ke ${camera.name || 'CCTV'}`}>
                <MapPin className="h-3 w-3" />
              </button>
              <button type="button" onClick={() => onRemove(camera)} className="rounded p-1 text-white/60 hover:bg-white/10 hover:text-red-300" title="Keluarkan" aria-label={`Keluarkan ${camera.name || 'CCTV'}`}>
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-[var(--border-secondary)]/40 p-2">
        <a
          href="/peta/multiview"
          target="_blank"
          rel="noopener"
          aria-disabled={cameras.length === 0}
          onClick={(e) => { if (cameras.length === 0) e.preventDefault(); }}
          className={`flex items-center justify-center gap-2 rounded border px-3 py-2 text-[10px] font-mono font-bold tracking-widest transition-colors ${
            cameras.length === 0
              ? 'cursor-not-allowed border-white/10 text-[var(--text-muted)] opacity-50'
              : 'border-[#00E5FF]/50 bg-[#00E5FF]/10 text-[#00E5FF] hover:bg-[#00E5FF]/20'
          }`}
        >
          BUKA MULTIVIEWER <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}
