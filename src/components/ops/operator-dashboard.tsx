"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, List, Map, PanelLeftClose, PanelLeftOpen, Users } from "lucide-react";
import { PortalMenu } from "@/components/ops/portal-menu";
import { AtlasChat } from "@/components/ops/atlas-chat";
import { OperatorBoard, type SituationRow } from "@/app/(id)/operator/operator-board";
import {
  filterSituations,
  formatWib,
  karhutlaScope,
  pageWindow,
  situationTotals,
  sortSituations,
  SITUATION_STATUSES,
  type SituationStatus,
} from "@/lib/ops/operator-view";

const PAGE_SIZE = 8;

export type OperatorIdentity = {
  name: string;
  username: string;
  role: string;
  portal: string;
  unit: string | null;
};

export type RevisionView = {
  id: string;
  at: string;
  code: string;
  name: string;
  status: SituationStatus;
  incidentCount: number;
  editor: string;
};

type Probe = "memeriksa" | "menjawab" | "gagal";

function statusClass(status: SituationStatus) {
  if (status === "SIAGA") return "border-[var(--alert-red)] text-[var(--alert-red)]";
  if (status === "WASPADA") return "border-[var(--alert-orange)] text-[var(--alert-orange)]";
  return "border-[var(--border-secondary)] text-[var(--text-heading)]";
}

function WibNow() {
  const [label, setLabel] = useState("WIB");
  const [full, setFull] = useState("Waktu Indonesia Barat");
  useEffect(() => {
    const clock = new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    const dated = new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta",
      dateStyle: "medium",
      timeStyle: "medium",
    });
    const tick = () => {
      const now = new Date();
      setLabel(`${clock.format(now)} WIB`);
      setFull(`${dated.format(now)} WIB`);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <time className="tabular-nums text-sm text-[var(--text-heading)]" title={full}>
      {label}
    </time>
  );
}

function useAppProbe() {
  const [state, setState] = useState<Probe>("memeriksa");
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  useEffect(() => {
    let stopped = false;
    const run = async () => {
      try {
        const response = await fetch("/api/health", { cache: "no-store" });
        const body = (await response.json().catch(() => null)) as { status?: string; scope?: string } | null;
        const serving = response.ok && body?.status === "serving" && body.scope === "process";
        if (stopped) return;
        setState(serving ? "menjawab" : "gagal");
        setCheckedAt(new Date().toISOString());
      } catch {
        if (stopped) return;
        setState("gagal");
        setCheckedAt(new Date().toISOString());
      }
    };
    void run();
    const id = window.setInterval(() => void run(), 60_000);
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, []);
  return { state, checkedAt };
}

function probeCopy(state: Probe) {
  if (state === "memeriksa") return "Memeriksa proses aplikasi.";
  if (state === "menjawab") return "Proses aplikasi merespons.";
  return "Proses aplikasi tidak merespons.";
}

export function OperatorDashboard({
  me,
  boardUser,
  canWrite,
  canManage,
  initial,
  revisions,
}: {
  me: OperatorIdentity;
  boardUser: { name: string; role: string; kotamaops: { code: string; name: string } | null };
  canWrite: boolean;
  canManage: boolean;
  initial: SituationRow[];
  revisions: RevisionView[];
}) {
  const pathname = usePathname();
  const probe = useAppProbe();
  const [open, setOpen] = useState(true);
  const [rows, setRows] = useState(initial);
  const [extra, setExtra] = useState<RevisionView[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<SituationStatus | "SEMUA">("SEMUA");
  const [direction, setDirection] = useState<"baru" | "lama">("baru");
  const [page, setPage] = useState(1);
  const [mapState, setMapState] = useState<"membuka" | "terbuka">("membuka");

  const totals = useMemo(() => situationTotals(rows), [rows]);
  const fires = useMemo(() => karhutlaScope(rows.map((row) => row.code)), [rows]);
  const listed = useMemo(
    () => sortSituations(filterSituations(rows, query, status), direction),
    [rows, query, status, direction],
  );
  const windowed = pageWindow(listed, page, PAGE_SIZE);
  const timeline = [...extra, ...revisions].slice(0, 20);
  const displayName = me.name.trim() || me.username;

  const links = [
    { href: "/operator", label: "Dasbor", full: "Dashboard operator", icon: LayoutDashboard },
    { href: "/peta", label: "Peta", full: "Peta situasi", icon: Map },
    { href: "#daftar-situasi", label: "Situasi", full: "Situasi satuan", icon: List },
  ];
  if (canManage) links.push({ href: "/pengguna", label: "Pengguna", full: "Pengguna", icon: Users });

  function onSaved(row: SituationRow) {
    setRows((current) => current.map((item) => (item.id === row.id ? row : item)));
    setExtra((current) => [
      {
        id: `simpan-${row.id}-${row.updatedAt}`,
        at: row.updatedAt,
        code: row.code,
        name: row.name,
        status: row.status,
        incidentCount: row.incidentCount,
        editor: row.updatedByName || displayName,
      },
      ...current.filter((item) => item.id !== `simpan-${row.id}-${row.updatedAt}`),
    ]);
  }

  const control =
    "min-h-11 rounded border border-[var(--control-border)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-heading)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold-primary)]";

  return (
    <div className="ops-scroll min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] selection:bg-[var(--gold-dim)] selection:text-[var(--text-heading)]">
      <div className="flex min-h-screen flex-col md:flex-row">
        <aside className={`bg-[var(--bg-secondary)] transition-[width] duration-300 ease-out md:shrink-0 ${open ? "md:w-52" : "md:w-14"}`}>
          <div className="hidden items-center gap-1 px-2 py-2 md:flex">
            <button
              type="button"
              className="hidden min-h-11 min-w-11 items-center justify-center rounded text-[var(--text-secondary)] hover:text-[var(--text-heading)] md:inline-flex focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold-primary)]"
              aria-expanded={open}
              aria-controls="menu-operasional"
              onClick={() => setOpen((value) => !value)}
            >
              {open ? <PanelLeftClose className="h-4 w-4" aria-hidden="true" /> : <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />}
              <span className="sr-only">{open ? "Ciutkan menu" : "Bentangkan menu"}</span>
            </button>
          </div>
          <nav id="menu-operasional" aria-label="Operasional" className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col">
            {links.map((item) => {
              const Icon = item.icon;
              const current = item.href === pathname;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={current ? "page" : undefined}
                  aria-label={item.full}
                  title={item.full}
                  className={`flex min-h-11 shrink-0 items-center gap-2 rounded px-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold-primary)] ${
                    current ? "bg-[var(--hover-accent)] text-[var(--gold-primary)]" : "text-[var(--text-secondary)] hover:text-[var(--text-heading)]"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className={open ? "" : "md:sr-only"}>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 lg:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <img src="/atlas-logo.svg" alt="" aria-hidden="true" className="h-10 w-10 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-[var(--gold-primary)]">ATLAS</p>
                <h1 className="truncate text-lg font-semibold leading-tight text-[var(--text-heading)]">Dashboard Operator</h1>
              </div>
            </div>
            <div className="flex max-w-full flex-wrap items-center gap-x-4 gap-y-2">
              <WibNow />
              <p className="min-w-0 max-w-full break-words text-sm text-[var(--text-heading)]">
                {displayName}
                <span className="text-[var(--text-secondary)]">
                  {" "}
                  · {me.portal}
                  {me.unit ? ` · ${me.unit}` : " · seluruh Kotamaops"}
                </span>
              </p>
              <PortalMenu role={me.role} name={displayName} className="ml-auto sm:ml-0" />
            </div>
          </header>

          <main className="space-y-6 px-4 pb-8 lg:px-6">
            <section aria-labelledby="ringkasan-judul" style={{ "--i": 0 } as React.CSSProperties} className="ops-rise">
              <h2 id="ringkasan-judul" className="text-base font-semibold text-[var(--text-heading)]">
                Ringkasan
              </h2>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                <Figure i={0} label="Satuan" value={totals.units.toLocaleString("id-ID")} />
                <Figure i={1} label="Siaga" value={totals.siaga.toLocaleString("id-ID")} tone="text-[var(--alert-red)]" />
                <Figure i={2} label="Waspada" value={totals.waspada.toLocaleString("id-ID")} tone="text-[var(--alert-orange)]" />
                <Figure i={3} label="Kondusif" value={totals.kondusif.toLocaleString("id-ID")} />
                <Figure i={4} label="Kejadian tersimpan" value={totals.incidentStored.toLocaleString("id-ID")} />
              </div>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                {fires.unitsOnReport === 0
                  ? `Karhutla: tidak ada pada laporan tetap ${fires.at} untuk cakupan ini.`
                  : `Karhutla, laporan tetap ${fires.at}: ${fires.dalamPemadaman.toLocaleString("id-ID")} satuan dalam pemadaman dari ${fires.unitsOnReport.toLocaleString("id-ID")} satuan pada laporan itu.`}
              </p>
            </section>

            <div style={{ "--i": 1 } as React.CSSProperties} className="ops-rise grid gap-6 xl:grid-cols-2">
              <section id="daftar-situasi" aria-labelledby="daftar-judul" className="min-w-0 scroll-mt-24 xl:relative xl:min-h-[28rem]">
                {/* Di xl kolom ini ikut tinggi formulir; isinya digulir sendiri. */}
                <div className="space-y-3 xl:absolute xl:inset-0 xl:overflow-y-auto xl:pr-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 id="daftar-judul" className="text-base font-semibold text-[var(--text-heading)]">
                      Situasi satuan
                    </h2>
                    {canWrite && (
                      <a
                        href="#formulir-situasi"
                        className="inline-flex min-h-11 items-center text-sm text-[var(--gold-primary)] underline decoration-[var(--gold-dim)] underline-offset-4"
                      >
                        Formulir simpan
                      </a>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <label className="min-w-0 basis-full text-sm text-[var(--text-secondary)] sm:basis-auto sm:flex-1">
                      Cari satuan atau lokasi
                      <input
                        value={query}
                        onChange={(event) => {
                          setQuery(event.target.value);
                          setPage(1);
                        }}
                        className={`mt-1 w-full ${control}`}
                      />
                    </label>
                    <label className="text-sm text-[var(--text-secondary)]">
                      Status
                      <select
                        value={status}
                        onChange={(event) => {
                          setStatus(event.target.value as SituationStatus | "SEMUA");
                          setPage(1);
                        }}
                        className={`mt-1 block ${control}`}
                      >
                        <option value="SEMUA">Semua</option>
                        {SITUATION_STATUSES.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setDirection((value) => (value === "baru" ? "lama" : "baru"));
                        setPage(1);
                      }}
                      className={`self-end ${control}`}
                    >
                      {direction === "baru" ? "Terbaru" : "Terlama"}
                    </button>
                  </div>
                  {windowed.total === 0 ? (
                    <p className="ops-fade bg-[var(--bg-secondary)] px-4 py-6 text-sm text-[var(--text-secondary)]">
                      {rows.length === 0 ? "Tidak ada Kotamaops pada cakupan akun ini." : "Tidak ada satuan yang cocok dengan pencarian atau status ini."}
                    </p>
                  ) : (
                    <>
                      <ul className="space-y-2 md:hidden">
                        {windowed.items.map((row, index) => (
                          <li key={row.id} style={{ "--i": index } as React.CSSProperties} className="ops-rise bg-[var(--bg-secondary)] px-4 py-3 text-sm">
                            <p className="font-medium text-[var(--text-heading)]">
                              {row.code} · {row.name}
                            </p>
                            <p className="mt-1 text-[var(--text-secondary)]">
                              {row.location}, {row.region}
                            </p>
                            <p className="mt-1 tabular-nums text-[var(--text-secondary)]">{formatWib(row.updatedAt)}</p>
                            <p className="mt-2">
                              <StatusBadge status={row.status} />
                            </p>
                            <p className="mt-1 tabular-nums">Kejadian tersimpan {row.incidentCount.toLocaleString("id-ID")}</p>
                            <a
                              href={`#satuan-${row.id}`}
                              className="mt-1 inline-flex min-h-11 items-center text-[var(--gold-primary)] underline decoration-[var(--gold-dim)] underline-offset-4"
                            >
                              {canWrite ? "Perbarui" : "Lihat"}
                            </a>
                          </li>
                        ))}
                      </ul>
                      <div className="hidden overflow-x-auto md:block">
                        <table className="w-full border-collapse text-left text-sm">
                          <caption className="sr-only">Situasi satuan dalam cakupan akun. Lokasi adalah markas satuan.</caption>
                          <thead className="text-[var(--text-secondary)]">
                            <tr>
                              <th className="px-2 py-2 font-medium">Waktu</th>
                              <th className="px-2 py-2 font-medium">Satuan</th>
                              <th className="hidden px-2 py-2 font-medium 2xl:table-cell">Lokasi</th>
                              <th className="px-2 py-2 font-medium">Status</th>
                              <th className="px-2 py-2 font-medium">Kejadian</th>
                              <th className="px-2 py-2 font-medium">Tindakan</th>
                            </tr>
                          </thead>
                          <tbody>
                            {windowed.items.map((row, index) => (
                              <tr key={row.id} style={{ "--i": index } as React.CSSProperties} className="ops-rise border-t border-[var(--border-secondary)] hover:bg-[var(--hover-accent)]">
                                <td className="min-w-[6.5rem] px-2 py-3 align-top tabular-nums">{formatWib(row.updatedAt)}</td>
                                <td className="px-2 py-3 align-top">
                                  <span className="font-medium text-[var(--text-heading)]">{row.code}</span>
                                  <span className="block whitespace-nowrap text-[var(--text-secondary)]">{row.name}</span>
                                </td>
                                <td className="hidden px-2 py-3 align-top text-[var(--text-secondary)] 2xl:table-cell">
                                  {row.location}
                                  <span className="block">{row.region}</span>
                                </td>
                                <td className="px-2 py-3 align-top">
                                  <StatusBadge status={row.status} />
                                </td>
                                <td className="px-2 py-3 align-top tabular-nums">{row.incidentCount.toLocaleString("id-ID")}</td>
                                <td className="px-2 py-3 align-top">
                                  <a
                                    href={`#satuan-${row.id}`}
                                    className="inline-flex min-h-11 items-center text-[var(--gold-primary)] underline decoration-[var(--gold-dim)] underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold-primary)]"
                                  >
                                    {canWrite ? "Perbarui" : "Lihat"}
                                  </a>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--text-secondary)]">
                    <p>
                      {windowed.total.toLocaleString("id-ID")} satuan · halaman {windowed.page.toLocaleString("id-ID")} dari{" "}
                      {windowed.pages.toLocaleString("id-ID")}
                    </p>
                    <div className="flex gap-2">
                      <button type="button" disabled={windowed.page <= 1} onClick={() => setPage(windowed.page - 1)} className={`${control} disabled:opacity-40`}>
                        Sebelumnya
                      </button>
                      <button
                        type="button"
                        disabled={windowed.page >= windowed.pages}
                        onClick={() => setPage(windowed.page + 1)}
                        className={`${control} disabled:opacity-40`}
                      >
                        Berikutnya
                      </button>
                    </div>
                  </div>
                </div>
              </section>
              <section id="formulir-situasi" aria-labelledby="formulir-judul" className="min-w-0 scroll-mt-24 space-y-3">
                <h2 id="formulir-judul" className="text-base font-semibold text-[var(--text-heading)]">
                  Formulir situasi
                </h2>
                <OperatorBoard me={boardUser} initial={rows} canWrite={canWrite} showChrome={false} onSaved={onSaved} />
              </section>
            </div>
            <section aria-labelledby="peta-judul" style={{ "--i": 2 } as React.CSSProperties} className="ops-rise space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="peta-judul" className="text-base font-semibold text-[var(--text-heading)]">
                  Peta situasi
                </h2>
                <Link
                  href="/peta"
                  className="inline-flex min-h-11 items-center text-sm text-[var(--gold-primary)] underline decoration-[var(--gold-dim)] underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold-primary)]"
                >
                  Peta penuh
                </Link>
              </div>
              {mapState === "membuka" && (
                <p className="text-sm text-[var(--text-secondary)]" role="status">
                  Membuka peta.
                </p>
              )}
              <div className="h-[52vh] min-h-[22rem] overflow-hidden rounded-lg border border-[var(--border-secondary)] bg-black md:h-[58vh] xl:h-[64vh]">
                <iframe title="Peta situasi ATLAS" src="/peta" loading="lazy" className={`h-full w-full border-0 transition-opacity duration-500 ${mapState === "terbuka" ? "opacity-100" : "opacity-0"}`} onLoad={() => setMapState("terbuka")} />
              </div>
            </section>


            <section aria-labelledby="riwayat-judul" style={{ "--i": 3 } as React.CSSProperties} className="ops-rise space-y-2">
              <h2 id="riwayat-judul" className="text-base font-semibold text-[var(--text-heading)]">
                Riwayat simpanan
              </h2>
              {timeline.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">Belum ada riwayat simpanan pada cakupan akun ini.</p>
              ) : (
                <ol className="max-h-60 space-y-2 overflow-y-auto pr-1 text-sm">
                  {timeline.map((item, index) => (
                    <li key={item.id} style={{ "--i": Math.min(index, 8) } as React.CSSProperties} className="ops-rise">
                      <time className="tabular-nums text-[var(--text-secondary)]" dateTime={item.at}>
                        {formatWib(item.at)}
                      </time>
                      <p>
                        <span className="text-[var(--text-heading)]">{item.code}</span> {item.name} · <StatusBadge status={item.status} /> · kejadian{" "}
                        {item.incidentCount.toLocaleString("id-ID")} · {item.editor}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
              <p className="text-xs text-[var(--text-secondary)]">Menampilkan sampai 20 simpanan terakhir pada cakupan akun.</p>
            </section>

            <section aria-labelledby="proses-judul" style={{ "--i": 4 } as React.CSSProperties} className="ops-rise space-y-2">
              <h2 id="proses-judul" className="text-base font-semibold text-[var(--text-heading)]">
                Status proses
              </h2>
              <p className="text-sm text-[var(--text-heading)]" role="status">
                {probeCopy(probe.state)}
                {probe.checkedAt ? ` Diperiksa ${formatWib(probe.checkedAt)}.` : ""}
              </p>
              <p className="max-w-3xl text-sm text-[var(--text-secondary)]">
                Pemeriksaan /api/health tiap sekitar satu menit hanya menunjukkan proses aplikasi merespons. Kesehatan CCTV dan feed peta belum
                dipantau di sini; lihat langsung di Peta situasi.
              </p>
              {totals.latestUpdate && (
                <p className="text-sm text-[var(--text-secondary)]">Pembaruan situasi tersimpan terakhir {formatWib(totals.latestUpdate)}.</p>
              )}
            </section>

          </main>
        </div>
      </div>
      <AtlasChat />
    </div>
  );
}

function Figure({ i, label, value, tone = "text-[var(--text-heading)]" }: { i: number; label: string; value: string; tone?: string }) {
  return (
    <div style={{ "--i": i } as React.CSSProperties} className="ops-rise ops-lift rounded-lg border border-[var(--border-secondary)] bg-[var(--bg-secondary)] px-4 py-3">
      <p className={`text-2xl font-semibold tabular-nums leading-none ${tone}`}>{value}</p>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">{label}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: SituationStatus }) {
  return <span className={`inline-block rounded border px-2 py-0.5 text-xs font-semibold tracking-wide ${statusClass(status)}`}>{status}</span>;
}
