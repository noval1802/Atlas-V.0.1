import type { CctvCamera } from './types';
import { stealthFetch } from '@/lib/stealthFetch';

/**
 * Jasa Marga toll layers from JID WFS: the CCTV layers, variable-message
 * signs (`shp:vms`), and kilometre posts (`shp:batas_km`). `shp:gerbang`
 * is the toll-gate inventory and is not requested.
 *
 * The layer token stays on the server. Per-camera session tokens and encoder
 * addresses stay there too. A picture is the public HLS playlist, a public
 * Jasa Marga frame URL, or no stream at all.
 */

const WFS = 'https://jid.jasamarga.com/geoserver/cloud/shp/wfs';
const LAYERS = [
  'shp:cctv_main',
  'shp:vms',
  'shp:cctv_gerbang',
  'shp:batas_km',
  'shp:cctv_ramp',
  'shp:cctv_arteri',
  'shp:cctv_ss',
  'shp:cctv_pemantauan',
] as const;

type Feature = {
  geometry?: { type?: string; coordinates?: unknown };
  properties?: Record<string, unknown>;
};

function pointInIndonesia(feature: Feature): { lat: number; lng: number } | null {
  const coordinates = feature.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
  const lng = Number(coordinates[0]);
  const lat = Number(coordinates[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -12 || lat > 7 || lng < 94 || lng > 142) return null;
  return { lat, lng };
}

/** A browser-facing Jasa Marga URL. Encoder hosts are left on the server. */
export function publicJasaMargaUrl(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    const host = url.hostname.toLowerCase();
    if (host !== 'jid.jasamarga.com' && host !== 'jmlive.jasamarga.com') return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function jasamargaCamera(feature: Feature, layer = 'arteri'): CctvCamera | null {
  const point = pointInIndonesia(feature);
  if (!point) return null;

  const props = feature.properties ?? {};
  if (String(props.enabled ?? '1') === '0') return null;

  const keyId = typeof props.key_id === 'string' ? props.key_id.trim() : '';
  const cameraId = props.camera_id ?? props.fid ?? keyId;
  const name = text(props.nama) || `CCTV ${cameraId}`;
  const km = text(props.km);
  const branch = text(props.cabang) || 'Jalan tol';
  const reloadOff = props.reload === false || props.reload === 'false';
  const hasSession = typeof props.token === 'string' && props.token.length > 0;
  const petunjuk = text(props.petunjuk);
  const safeKey = /^[A-Za-z0-9._-]+$/.test(keyId);

  const camera: CctvCamera = {
    id: `jm-${layer}-${cameraId}`,
    lat: point.lat,
    lng: point.lng,
    name: km && !name.includes(km) ? `${name} · ${km}` : name,
    city: branch,
    country: 'Indonesia',
    source: 'Jasa Marga',
  };

  if (reloadOff && hasSession && safeKey && props.id_ruas != null && String(props.id_ruas) !== '') {
    camera.stream_url = `https://jmlive.jasamarga.com/hls/${encodeURIComponent(String(props.id_ruas))}/${encodeURIComponent(keyId)}/index.m3u8`;
    camera.stream_type = 'hls';
    camera.external_url = `https://jid.jasamarga.com/cctv2/${encodeURIComponent(keyId)}`;
    return camera;
  }

  if (/vmzm/i.test(petunjuk)) {
    camera.stream_url = petunjuk;
    camera.stream_type = 'mjpeg';
    camera.external_url = petunjuk;
    return camera;
  }

  if (safeKey) camera.external_url = `https://jid.jasamarga.com/cctv2/${encodeURIComponent(keyId)}`;
  return camera;
}

/** Variable-message signs. A direct encoder URL is not sent to the browser. */
export function jasamargaVms(feature: Feature): CctvCamera | null {
  const point = pointInIndonesia(feature);
  if (!point) return null;
  const props = feature.properties ?? {};
  const fid = props.fid ?? props.kode_vms ?? '';
  const name = text(props.nama_vms) || text(props.nama_lokasi) || text(props.kode_vms) || `VMS ${fid}`;
  const km = text(props.km);
  const sign: CctvCamera = {
    id: `jm-vms-${fid}`,
    lat: point.lat,
    lng: point.lng,
    name: km && !name.includes(km) ? `${name} · ${km}` : name,
    city: text(props.cabang) || text(props.nama_tol) || 'Jalan tol',
    country: 'Indonesia',
    source: 'Jasa Marga',
  };
  const pub = publicJasaMargaUrl(props.url_cctv_public);
  if (!pub) return sign;
  sign.external_url = pub;
  if (/\.m3u8(?:$|\?)/i.test(pub)) {
    sign.stream_url = pub;
    sign.stream_type = 'hls';
  } else if (/\.mjpe?g(?:$|\?)/i.test(pub)) {
    sign.stream_url = pub;
    sign.stream_type = 'mjpeg';
  }
  return sign;
}

/** Kilometre posts. They are positions, not pictures. */
export function jasamargaBatasKm(feature: Feature): CctvCamera | null {
  const point = pointInIndonesia(feature);
  if (!point) return null;
  const props = feature.properties ?? {};
  const id = props.id ?? props.fid;
  const label = text(props.label) || `KM ${id}`;
  return {
    id: `jm-batas-km-${id}`,
    lat: point.lat,
    lng: point.lng,
    name: label,
    city: props.id_ruas != null && String(props.id_ruas) !== '' ? `Ruas ${props.id_ruas}` : 'Jalan tol',
    country: 'Indonesia',
    source: 'Jasa Marga',
  };
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function mapFeature(feature: Feature, typeName: (typeof LAYERS)[number]): CctvCamera | null {
  if (typeName === 'shp:vms') return jasamargaVms(feature);
  if (typeName === 'shp:batas_km') return jasamargaBatasKm(feature);
  return jasamargaCamera(feature, typeName.replace('shp:cctv_', ''));
}

async function fetchLayer(token: string, typeName: (typeof LAYERS)[number]): Promise<CctvCamera[]> {
  const url = new URL(WFS);
  url.searchParams.set('CQL_FILTER', ' ');
  url.searchParams.set('service', 'WFS');
  url.searchParams.set('token', token);
  url.searchParams.set('version', '1.0.0');
  url.searchParams.set('request', 'GetFeature');
  url.searchParams.set('typeName', typeName);
  url.searchParams.set('outputFormat', 'application/json');
  // GeoServer builds the main-road layer before the first byte. That takes
  // longer than the 30s stealth default and the 12s region budget; the budget
  // drops this region from the current response while this fetch keeps running.
  const response = await stealthFetch(url, {
    signal: AbortSignal.timeout(180000),
    timeoutMs: 180000,
  });
  if (!response.ok) throw new Error(`${typeName} HTTP ${response.status}`);
  const body = await response.json() as { features?: Feature[] };
  const cameras: CctvCamera[] = [];
  for (const feature of body.features ?? []) {
    const camera = mapFeature(feature, typeName);
    if (camera) cameras.push(camera);
  }
  return cameras;
}

export async function fetchJasamargaCameras(): Promise<CctvCamera[]> {
  const token = process.env.JASAMARGA_WFS_TOKEN;
  if (!token) return [];
  const batches = await Promise.all(LAYERS.map(async (typeName) => {
    try {
      return await fetchLayer(token, typeName);
    } catch (error) {
      console.warn('[OSIRIS] Jasa Marga CCTV failed:', error instanceof Error ? error.message : error);
      return [];
    }
  }));
  return batches.flat();
}
