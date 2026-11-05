/**
 * MAGMA Indonesia (PVMBG): the activity level of every monitored volcano.
 * The JSON API needs a token; the public map page embeds the same list as
 * `var markersGunungApi = [...]`, so that is what is read.
 */

import { cachedSource } from '@/lib/sourceCache';

export const MAGMA_MAP_URL = 'https://magma.esdm.go.id/v1';

/** 1 Normal, 2 Waspada, 3 Siaga, 4 Awas — PVMBG's own scale. */
export type VolcanoLevel = 1 | 2 | 3 | 4;

export interface Volcano {
  code: string;
  name: string;
  province: string;
  elevation: number;
  lat: number;
  lng: number;
  level: VolcanoLevel;
  /** MAGMA shows its eruption icon: an eruption report was filed recently. */
  erupting: boolean;
  /** An aviation ash advisory (VONA) is in force. */
  vona: boolean;
}

interface MagmaMarker {
  ga_code?: string;
  ga_nama_gapi?: string;
  ga_prov_gapi?: string;
  ga_elev_gapi?: number;
  ga_lat_gapi?: number;
  ga_lon_gapi?: number;
  ga_status?: number;
  has_vona?: boolean;
  erupt_icon?: boolean;
}

/** Index of the `]` closing the array that opens at `start`, skipping brackets inside strings. */
function arrayEnd(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === '\\') i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === '[') depth++;
    else if (c === ']' && --depth === 0) return i;
  }
  throw new Error('MAGMA volcano list is cut off');
}

/** Volcanoes from the MAGMA map page. Throws when the page no longer carries the list. */
export function parseMagmaVolcanoes(page: string): Volcano[] {
  const start = page.indexOf('[', page.indexOf('markersGunungApi'));
  if (page.indexOf('markersGunungApi') < 0 || start < 0) throw new Error('MAGMA volcano list not found');
  const markers = JSON.parse(page.slice(start, arrayEnd(page, start) + 1)) as MagmaMarker[];
  const volcanoes: Volcano[] = [];
  for (const m of markers) {
    const lat = m.ga_lat_gapi;
    const lng = m.ga_lon_gapi;
    const level = Number(m.ga_status);
    if (!m.ga_code || !m.ga_nama_gapi || typeof lat !== 'number' || typeof lng !== 'number') continue;
    volcanoes.push({
      code: m.ga_code,
      name: m.ga_nama_gapi,
      province: m.ga_prov_gapi ?? '',
      elevation: Number(m.ga_elev_gapi) || 0,
      lat,
      lng,
      level: (level >= 1 && level <= 4 ? level : 1) as VolcanoLevel,
      erupting: m.erupt_icon === true,
      vona: m.has_vona === true,
    });
  }
  return volcanoes;
}

export const MAGMA_LEVELS_URL = 'https://magma.esdm.go.id/v1/gunung-api/tingkat-aktivitas';

/* MAGMA signs each report link; an unsigned or altered one is refused. So the
   links are only ever taken from MAGMA's own activity-level page, never built. */
const REPORT_LINK = /<td>\s*([^<]+?)\s+-\s+[^<]*<a href="(https:\/\/magma\.esdm\.go\.id\/v1\/gunung-api\/laporan\/\d+\?signature=[0-9a-f]+)"/g;

/** Volcano name → signed link to its latest activity report. */
export function parseReportLinks(page: string): Map<string, string> {
  const links = new Map<string, string>();
  for (const [, name, url] of page.matchAll(REPORT_LINK)) links.set(decodeHtml(name).trim(), url);
  return links;
}

export interface VolcanoReport {
  /** "Anak Krakatau, Sabtu - 31 Oktober 2026, periode 12:00-18:00 WIB" */
  title: string;
  level: string;
  author: string;
  /** The observation image filed with this report. MAGMA keeps them on several ESDM hosts; some reports have none. */
  image?: string;
  /** In page order: Pengamatan Visual, Keterangan Lainnya, Klimatologi, Pengamatan Kegempaan, Rekomendasi. */
  sections: { heading: string; lines: string[] }[];
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', deg: '°' };

function decodeHtml(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] !== '#') return ENTITIES[e.toLowerCase()] ?? m;
    const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return Number.isFinite(code) ? String.fromCodePoint(code) : m;
  });
}

const plain = (html: string) => decodeHtml(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

/** The text of one activity report page. Throws when it is not one. */
export function parseMagmaReport(page: string): VolcanoReport {
  const title = page.match(/<h5 class="card-title[^"]*">([\s\S]*?)<\/h5>/)?.[1];
  if (!title) throw new Error('Not a MAGMA activity report');
  const sections: VolcanoReport['sections'] = [];
  for (const [, heading, body] of page.matchAll(/<h6 class="slim-card-title">([\s\S]*?)<\/h6>([\s\S]*?)<\/div>/g)) {
    // Each <p> is an item; Rekomendasi numbers its items inside one <p> with <br />.
    const lines = body.split(/<\/p>|<br\s*\/?>/i).map(plain).filter(Boolean);
    if (lines.length) sections.push({ heading: plain(heading), lines });
  }
  return {
    title: plain(title),
    level: plain(page.match(/<span class="badge[^"]*">([\s\S]*?)<\/span>/)?.[1] ?? ''),
    author: plain(page.match(/Dibuat oleh,\s*([^<]+)/)?.[1] ?? ''),
    image: page.match(/<img class="img-fluid" src="(https:\/\/(?:[a-z0-9-]+\.)*esdm\.go\.id\/[^"\s]+)"/)?.[1],
    sections,
  };
}

/* ── Loaders. Levels change a few times a month and reports every six hours,
   so ten minutes keeps the map current without leaning on a government site.
   A throw keeps the last good copy in the cache. ── */
const TTL_MS = 10 * 60_000;

async function magmaPage(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`MAGMA ${res.status}`);
  return res.text();
}

export const loadVolcanoes = cachedSource('volcanoes:magma', async () => parseMagmaVolcanoes(await magmaPage(MAGMA_MAP_URL)), TTL_MS);

const loadReportLinks = cachedSource('volcanoes:report-links', async () => [...parseReportLinks(await magmaPage(MAGMA_LEVELS_URL))], TTL_MS);

/** The latest activity report for a volcano code, with the signed link it came from; null for an unknown code. */
export async function loadReport(code: string): Promise<{ report: VolcanoReport; url: string } | null> {
  const name = (await loadVolcanoes()).find(v => v.code === code)?.name;
  const url = name ? new Map(await loadReportLinks()).get(name) : undefined;
  if (!url) return null;
  const [report] = await cachedSource(`volcanoes:report:${code}`, async () => [parseMagmaReport(await magmaPage(url))], TTL_MS)();
  return report ? { report, url } : null;
}
