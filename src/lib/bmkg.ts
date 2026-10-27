/**
 * BMKG open data: earthquakes (InaTEWS) and Peringatan Dini Cuaca (bulletin list + CAP polygons).
 *
 * BMKG answers 403 to requests without a User-Agent, so every call names ATLAS.
 * Their published limit is 60 requests per minute per IP; callers cache.
 */
import type { EarthquakeRow } from '@/lib/map-data';

export const BMKG_HEADERS = { 'User-Agent': 'ATLAS-Pusdalops/1.0 (monitoring situasi nasional)' };

export const BMKG_QUAKE_URLS = [
  'https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json',
  'https://data.bmkg.go.id/DataMKG/TEWS/gempadirasakan.json',
];
/** Provincial Peringatan Dini Cuaca bulletins. Each code also names a CAP file with the polygon. */
export const BMKG_WARNING_URL = 'https://api-apps.bmkg.go.id/api/warningcuaca/';

interface BmkgQuake {
  DateTime?: string;
  Coordinates?: string;
  Magnitude?: string;
  Kedalaman?: string;
  Wilayah?: string;
  Potensi?: string;
  Dirasakan?: string;
}

/** Rows from one InaTEWS file. `gempa` is a list in the terkini/dirasakan files and an object in autogempa. */
export function parseBmkgQuakes(body: unknown): EarthquakeRow[] {
  const raw = (body as { Infogempa?: { gempa?: BmkgQuake | BmkgQuake[] } })?.Infogempa?.gempa;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const rows: EarthquakeRow[] = [];
  for (const q of list) {
    const [lat, lng] = (q.Coordinates ?? '').split(',').map(Number);
    const time = Date.parse(q.DateTime ?? '');
    const magnitude = Number(q.Magnitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(time) || !Number.isFinite(magnitude)) continue;
    const potensi = q.Potensi ?? '';
    rows.push({
      id: `bmkg-${time}-${q.Coordinates}`,
      lat,
      lng,
      depth: parseFloat(q.Kedalaman ?? '') || 0,
      magnitude,
      place: q.Wilayah,
      time,
      url: 'https://data.bmkg.go.id/gempabumi/',
      source: 'BMKG',
      // "Tidak berpotensi tsunami" also contains "berpotensi tsunami".
      tsunami: /berpotensi tsunami/i.test(potensi) && !/tidak berpotensi/i.test(potensi) ? 1 : 0,
      type: q.Dirasakan ? `Dirasakan: ${q.Dirasakan}` : 'earthquake',
    });
  }
  return rows;
}

/** One quake can sit in both the M5+ and the felt list; keep the first, newest first. */
export function mergeQuakes(lists: EarthquakeRow[][]): EarthquakeRow[] {
  const byId = new Map<string, EarthquakeRow>();
  for (const row of lists.flat()) if (row.id && !byId.has(row.id)) byId.set(row.id, row);
  return [...byId.values()].sort((a, b) => (b.time ?? 0) - (a.time ?? 0));
}

const tag = (xml: string, name: string) =>
  (xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'))?.[1] ?? '').trim();

export interface WarningBulletin {
  code: string;
  capUrl: string;
  description?: string;
  infographic?: string;
}

const BMKG_IMAGE = /^https:\/\/api-apps\.bmkg\.go\.id\/api\/warningcuaca\/image\?path=[\w.-]+$/;

/** The warningcuaca list. Codes and image links are checked because they end up in a fetch and an href. */
export function parseWarningList(body: unknown): WarningBulletin[] {
  if (!Array.isArray(body)) return [];
  const out: WarningBulletin[] = [];
  for (const row of body as Array<Record<string, unknown>>) {
    const code = typeof row?.ID_Kode === 'string' ? row.ID_Kode : '';
    if (!/^[A-Z]{3}\d{8,}$/.test(code)) continue;
    const image = typeof row.infografis === 'string' && BMKG_IMAGE.test(row.infografis) ? row.infografis : undefined;
    out.push({
      code,
      capUrl: `https://www.bmkg.go.id/alerts/nowcast/id/${code}_alert.xml`,
      description: typeof row.description === 'string' ? row.description.trim() : undefined,
      infographic: image,
    });
  }
  return out;
}

export interface NowcastAlert {
  id: string;
  headline: string;
  event: string;
  severity: 'low' | 'medium' | 'high';
  lat: number;
  lng: number;
  effective?: string;
  expires?: string;
  area?: string;
}

/** One CAP 1.2 alert, placed at the mean of its polygon (`lat,lng` pairs). */
export function parseNowcastCap(xml: string): NowcastAlert | null {
  const points = tag(xml, 'polygon').split(/\s+/).map(p => p.split(',').map(Number)).filter(p => p.length === 2 && p.every(Number.isFinite));
  if (!points.length) return null;
  const sev = tag(xml, 'severity');
  return {
    id: `bmkg-${tag(xml, 'identifier')}`,
    headline: tag(xml, 'headline') || tag(xml, 'event') || 'Peringatan Dini Cuaca',
    event: tag(xml, 'event') || 'Peringatan Dini Cuaca',
    severity: sev === 'Extreme' || sev === 'Severe' ? 'high' : sev === 'Moderate' ? 'medium' : 'low',
    lat: points.reduce((s, p) => s + p[0], 0) / points.length,
    lng: points.reduce((s, p) => s + p[1], 0) / points.length,
    effective: tag(xml, 'effective') || undefined,
    expires: tag(xml, 'expires') || undefined,
    area: tag(xml, 'areaDesc') || undefined,
  };
}
