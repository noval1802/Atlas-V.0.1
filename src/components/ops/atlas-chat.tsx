"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Send, X } from "lucide-react";

type Turn = { role: "user" | "assistant"; content: string };

export function AtlasChat() {
  const bounds = useRef<HTMLDivElement>(null);
  const dragged = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [turns, busy]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    // Keep the last turns only; the server rejects more than 20.
    const next = [...turns, { role: "user" as const, content: text }].slice(-19);
    setTurns(next);
    setDraft("");
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next[0].role === "user" ? next : next.slice(1) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal menghubungi asisten.");
      setTurns((t) => [...t, { role: "assistant", content: data.reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghubungi asisten.");
      setTurns((t) => t.slice(0, -1));
      setDraft(text);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div ref={bounds} aria-hidden="true" className="pointer-events-none fixed inset-3 z-40" />

      <motion.button
        type="button"
        drag
        dragConstraints={bounds}
        dragMomentum={false}
        dragElastic={0.1}
        onDragStart={() => (dragged.current = true)}
        onClick={() => {
          if (dragged.current) return void (dragged.current = false);
          setOpen((v) => !v);
        }}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.95 }}
        aria-expanded={open}
        aria-controls="atlas-chat"
        title="Asisten ATLAS (bisa digeser)"
        className="fixed bottom-5 right-5 z-50 grid h-16 w-16 cursor-grab touch-none place-items-center rounded-full border border-[var(--gold-dim)] bg-[var(--bg-secondary)] shadow-[0_0_24px_rgba(212,175,55,0.25)] active:cursor-grabbing focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold-primary)]"
      >
        <img src="/atlas-logo.svg" alt="" draggable={false} className="pointer-events-none h-12 w-12" />
        <span className="sr-only">{open ? "Tutup asisten ATLAS" : "Buka asisten ATLAS"}</span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.section
            id="atlas-chat"
            aria-label="Asisten ATLAS"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed inset-x-3 bottom-24 z-50 flex max-h-[70vh] flex-col overflow-hidden rounded-xl border border-[var(--border-secondary)] bg-[var(--bg-secondary)] shadow-2xl sm:inset-x-auto sm:right-5 sm:w-96"
          >
            <header className="flex items-center gap-2 border-b border-[var(--border-secondary)] px-4 py-3">
              <img src="/atlas-logo.svg" alt="" className="h-6 w-6" />
              <h2 className="flex-1 text-sm font-semibold text-[var(--text-heading)]">Asisten ATLAS</h2>
              <button type="button" onClick={() => setOpen(false)} className="inline-flex min-h-9 min-w-9 items-center justify-center rounded text-[var(--text-secondary)] hover:text-[var(--text-heading)]">
                <X className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">Tutup</span>
              </button>
            </header>

            <div ref={log} role="log" aria-live="polite" className="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-sm">
              {turns.length === 0 && (
                <p className="text-[var(--text-secondary)]">
                  Tanyakan apa saja seputar penggunaan ATLAS. Asisten tidak membaca data situasi, peta, atau CCTV.
                </p>
              )}
              {turns.map((t, i) => (
                <p
                  key={i}
                  className={`whitespace-pre-wrap rounded-lg px-3 py-2 ${t.role === "user" ? "ml-8 bg-[var(--gold-dim)] text-[var(--text-heading)]" : "mr-8 bg-[var(--bg-primary)] text-[var(--text-primary)]"}`}
                >
                  {t.content}
                </p>
              ))}
              {busy && <p className="mr-8 text-[var(--text-secondary)]">Menyusun jawaban…</p>}
              {error && <p role="alert" className="text-red-400">{error}</p>}
            </div>

            <form onSubmit={send} className="flex gap-2 border-t border-[var(--border-secondary)] p-3">
              <label htmlFor="atlas-chat-input" className="sr-only">Pesan</label>
              <input
                id="atlas-chat-input"
                ref={input}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={2000}
                placeholder="Ketik pesan…"
                className="min-w-0 flex-1 rounded-md border border-[var(--border-secondary)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:border-[var(--gold-primary)] focus:outline-none"
              />
              <button type="submit" disabled={busy || !draft.trim()} className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md bg-[var(--gold-primary)] text-black disabled:opacity-40">
                <Send className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">Kirim</span>
              </button>
            </form>
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
}
