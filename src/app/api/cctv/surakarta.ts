import type { CctvCamera } from './types';
import { SURAKARTA_CAMERAS } from './surakarta-cameras';

/**
 * Kota Surakarta (Solo) CCTV from the Dishub CC Room portal.
 *
 * The portal (`ccroom-dishub.surakarta.go.id`) streams HTTP-FLV from
 * `surakarta.atcsindonesia.info:8086/camera/<name>.flv` and publishes no
 * coordinates, so the camera list and its coordinates are baked in
 * (see surakarta-cameras.ts). FLV plays via mpegts.js in the full viewer; on
 * the map these stay dots and open on click (no FLV preview tile).
 *
 * The .flv answers with `Access-Control-Allow-Origin: *`, so the browser plays
 * it straight from the origin — no proxy.
 */

const STREAM_BASE = 'https://surakarta.atcsindonesia.info:8086/camera';

export async function fetchSurakartaCameras(): Promise<CctvCamera[]> {
  return SURAKARTA_CAMERAS.map(c => ({
    id: `surakarta-${c.stream}`,
    lat: c.lat,
    lng: c.lng,
    name: c.name,
    city: 'Kota Surakarta',
    country: 'Indonesia',
    source: 'Dishub Surakarta',
    stream_url: `${STREAM_BASE}/${c.stream}.flv`,
    stream_type: 'flv',
  }));
}
