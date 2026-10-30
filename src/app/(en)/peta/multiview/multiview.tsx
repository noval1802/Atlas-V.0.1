'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Cctv, Maximize, Minimize, X } from 'lucide-react';
import { CameraFeedView, useCameraFeed } from '@/components/camera-feed-view';
import type { WatchedCamera } from '@/lib/dashboard-state';
import { autoGrid, spaceCamKey, toggleSpaceCam, useSpaceCams, writeSpaceCams } from '@/lib/space-cams';

/** 0 = AUTO: the grid grows with the number of chosen cameras. Others fix the grid and page through the rest. */
const PRESETS = [
  { size: 0, label: 'AUTO' },
  { size: 1, label: '1' },
  { size: 2, label: '2×2' },
  { size: 3, label: '3×3' },
  { size: 4, label: '4×4' },
] as const;

function Tile({ camera, onRemove }: { camera: WatchedCamera; onRemove: () => void }) {
  const feed = useCameraFeed(camera);
  return (
    <div className="group relative min-h-0 min-w-0 overflow-hidden bg-[#020202] outline outline-1 outline-white/10">
      <CameraFeedView feed={feed} contain />
      <div className="absolute inset-x-0 bottom-0 z-40 flex items-center gap-2 bg-gradient-to-t from-black/85 to-transparent px-2 py-1">
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] tracking-wider text-white" title={camera.name}>
          {camera.name || 'CCTV'}
          {camera.city ? <span className="text-white/50"> · {camera.city}</span> : null}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="rounded p-1 text-white/60 opacity-0 transition-opacity hover:bg-white/15 hover:text-red-300 focus-visible:opacity-100 group-hover:opacity-100"
          title="Keluarkan dari multiviewer"
          aria-label={`Keluarkan ${camera.name || 'CCTV'} dari multiviewer`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function MultiView() {
  const cameras = useSpaceCams();
  const [preset, setPreset] = useState(0);
  const [page, setPage] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  const perPage = preset === 0 ? Math.max(1, cameras.length) : preset * preset;
  const pages = Math.max(1, Math.ceil(cameras.length / perPage));
  const current = Math.min(page, pages - 1);
  const shown = cameras.slice(current * perPage, current * perPage + perPage);
  const { cols, rows } = preset === 0 ? autoGrid(cameras.length) : { cols: preset, rows: preset };

  const choosePreset = useCallback((size: number) => { setPreset(size); setPage(0); }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => { /* refused by the browser */ });
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // F: fullscreen · 0–4: preset · ←/→: page
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'f' || e.key === 'F') toggleFullscreen();
      else if (/^[0-4]$/.test(e.key)) choosePreset(Number(e.key));
      else if (e.key === 'ArrowRight') setPage((p) => Math.min(p + 1, pages - 1));
      else if (e.key === 'ArrowLeft') setPage((p) => Math.max(p - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleFullscreen, choosePreset, pages]);

  return (
    <main className="fixed inset-0 flex flex-col bg-black text-white">
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-white/10 bg-[#07070b] px-3 py-1.5 font-mono text-[10px] tracking-widest">
        <Cctv className="h-4 w-4 text-[#00E5FF]" aria-hidden="true" />
        <h1 className="font-bold text-[#00E5FF]">MULTIVIEWER CCTV</h1>
        <span className="text-white/50">{cameras.length} KAMERA</span>

        <div role="group" aria-label="Preset layout" className="ml-auto flex items-center gap-1">
          <span className="mr-1 text-white/40">LAYOUT</span>
          {PRESETS.map(({ size, label }) => (
            <button
              key={size}
              type="button"
              onClick={() => choosePreset(size)}
              aria-pressed={preset === size}
              title={size === 0 ? 'Otomatis menyesuaikan jumlah kamera (0)' : `${label} per halaman (${size})`}
              className={`rounded border px-2 py-1 transition-colors ${
                preset === size ? 'border-[#00E5FF]/60 bg-[#00E5FF]/15 text-[#00E5FF]' : 'border-white/10 text-white/60 hover:bg-white/10'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {pages > 1 && (
          <div className="flex items-center gap-1" aria-label="Halaman">
            <button type="button" onClick={() => setPage(Math.max(current - 1, 0))} disabled={current === 0} className="rounded p-1 hover:bg-white/10 disabled:opacity-30" aria-label="Halaman sebelumnya">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="tabular-nums text-white/70">{current + 1}/{pages}</span>
            <button type="button" onClick={() => setPage(Math.min(current + 1, pages - 1))} disabled={current >= pages - 1} className="rounded p-1 hover:bg-white/10 disabled:opacity-30" aria-label="Halaman berikutnya">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={toggleFullscreen}
          title="Layar penuh (F)"
          className="flex items-center gap-1.5 rounded border border-white/10 px-2 py-1 text-white/70 hover:bg-white/10"
        >
          {fullscreen ? <Minimize className="h-3.5 w-3.5" /> : <Maximize className="h-3.5 w-3.5" />}
          {fullscreen ? 'KELUAR' : 'LAYAR PENUH'}
        </button>
      </header>

      {cameras.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-6 text-center font-mono text-xs leading-relaxed text-white/50">
          <p>
            Belum ada CCTV dipilih.<br />
            Di tab peta, klik CCTV lalu tekan <span className="text-[#00E5FF]">PILIH UNTUK SPACE</span> — kamera langsung muncul di sini.
          </p>
        </div>
      ) : (
        <div
          className="grid min-h-0 flex-1 gap-px bg-white/5"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}
        >
          {shown.map((camera) => (
            <Tile key={spaceCamKey(camera)} camera={camera} onRemove={() => writeSpaceCams(toggleSpaceCam(cameras, camera))} />
          ))}
        </div>
      )}
    </main>
  );
}
