'use client';

import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { KeyRound, X } from 'lucide-react';

type Source = { id: string; label: string; hint: string; configured: boolean };

/**
 * One key opens a form per CCTV token. The stored value is never sent back
 * to the browser; each field only accepts a replacement.
 */
export default function CctvTokenButton({ compact = false, onSaved }: { compact?: boolean; onSaved?: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [sources, setSources] = useState<Source[] | null>(null);
  const [gate, setGate] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<Record<string, string>>({});
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      const response = await fetch('/api/cctv/tokens', { cache: 'no-store' });
      if (cancelled) return;
      if (response.status === 401) {
        setSources(null);
        setGate('Masuk sebagai admin untuk mengubah token.');
        return;
      }
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setSources(null);
        setGate(typeof body.error === 'string' ? body.error : 'Token tidak dapat dibuka.');
        return;
      }
      const body = await response.json();
      setSources(Array.isArray(body.sources) ? body.sources : []);
    })();
    return () => { cancelled = true; };
  }, [open]);

  async function save(id: string) {
    setBusy(id);
    setNotice(current => ({ ...current, [id]: '' }));
    try {
      const response = await fetch('/api/cctv/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, token: drafts[id] ?? '' }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNotice(current => ({ ...current, [id]: typeof body.error === 'string' ? body.error : 'Token tidak tersimpan.' }));
        return;
      }
      setDrafts(current => ({ ...current, [id]: '' }));
      setSources(current => current?.map(source => source.id === id ? { ...source, configured: true } : source) ?? current);
      setNotice(current => ({ ...current, [id]: 'Tersimpan. Token lama diganti dan daftar kamera dimuat ulang.' }));
      onSaved?.(id);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={compact ? '' : 'relative group'}>
      <button
        type="button"
        onClick={() => { setGate(null); setOpen(value => !value); }}
        className={compact
          ? 'pointer-events-auto glass-panel px-2 py-1.5 text-[#D4AF37] border-[#D4AF37]/40'
          : `relative w-8 h-8 rounded-full flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white/50 ${open ? 'bg-[#D4AF37]/20' : 'hover:bg-white/10'}`}
        title="Token CCTV"
        aria-label="Token CCTV"
        aria-expanded={open}
        aria-controls={open ? titleId : undefined}
      >
        <KeyRound className={compact ? 'w-3.5 h-3.5' : `w-4 h-4 ${open ? 'text-[#D4AF37]' : 'text-white/60'}`} />
      </button>
      {!compact && (
        <span className="absolute right-11 top-1/2 -translate-y-1/2 px-2 py-1 text-[9px] font-mono tracking-wider text-white/80 bg-black/80 backdrop-blur-sm rounded whitespace-nowrap opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity pointer-events-none">TOKEN</span>
      )}
      {open && typeof document !== 'undefined' && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className={compact
            ? 'fixed inset-x-3 top-14 z-[280] bg-[#0A0A0A] border border-[var(--border-primary)] shadow-2xl p-3'
            : 'fixed right-16 top-1/2 z-[280] w-80 -translate-y-1/2 bg-[#0A0A0A] border border-[var(--border-primary)] shadow-2xl p-3'}
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 id={titleId} className="text-[10px] font-mono font-bold tracking-[0.2em] text-[#D4AF37]">TOKEN CCTV</h2>
            <button type="button" onClick={() => setOpen(false)} className="p-1 hover:bg-white/10" aria-label="Tutup">
              <X className="w-3.5 h-3.5 text-white/60" />
            </button>
          </div>
          {!gate && !sources && <p className="text-[11px] font-mono text-white/50">Memuat…</p>}
          {gate && (
            <p className="text-[11px] font-mono text-white/70">
              {gate}{' '}
              {gate.startsWith('Masuk') && <a className="text-[#D4AF37] underline" href="/masuk">Masuk</a>}
            </p>
          )}
          {sources?.map(source => (
            <form
              key={source.id}
              className="mb-3 border border-white/10 p-2"
              onSubmit={event => { event.preventDefault(); void save(source.id); }}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <label htmlFor={`cctv-token-${source.id}`} className="text-[10px] font-mono tracking-wider text-white">{source.label}</label>
                <span className={`text-[9px] font-mono ${source.configured ? 'text-[var(--alert-green)]' : 'text-white/40'}`}>
                  {source.configured ? 'TERSIMPAN' : 'KOSONG'}
                </span>
              </div>
              <p className="mb-2 text-[9px] font-mono text-white/40">{source.hint}</p>
              <input
                id={`cctv-token-${source.id}`}
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={drafts[source.id] ?? ''}
                onChange={event => setDrafts(current => ({ ...current, [source.id]: event.target.value }))}
                placeholder="Tempel token baru"
                className="mb-2 w-full bg-black/60 border border-white/15 px-2 py-1.5 text-[11px] font-mono text-white outline-none focus:border-[#D4AF37]/60"
              />
              <button
                type="submit"
                disabled={busy === source.id || !(drafts[source.id] ?? '').trim()}
                className="bg-[#D4AF37]/15 px-2 py-1 text-[9px] font-mono tracking-[0.15em] text-[#D4AF37] disabled:opacity-40"
              >
                {busy === source.id ? 'MENYIMPAN' : 'SIMPAN'}
              </button>
              {notice[source.id] && <p className="mt-1 text-[9px] font-mono text-white/70">{notice[source.id]}</p>}
            </form>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
