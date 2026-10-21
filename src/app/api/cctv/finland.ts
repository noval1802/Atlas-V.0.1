import type { CatalogCamera } from '@/lib/camera-catalog';
import { stealthFetch } from '@/lib/stealthFetch';

/**
 * OSIRIS — Finland CCTV Cameras (Digitraffic / Fintraffic)
 * Source: https://tie.digitraffic.fi/api/weathercam/v1/stations
 * ~470 weathercam stations across Finland — NO API KEY NEEDED
 */

interface FinlandPreset {
  imageUrl?: string;
  id?: string | number;
}

interface FinlandFeature {
  id?: string | number;
  geometry?: { coordinates?: number[] };
  properties?: {
    id?: string | number;
    presets?: FinlandPreset[];
    name?: string;
    names?: { fi?: string };
    municipality?: string;
  };
}

interface FinlandStations {
  features?: FinlandFeature[];
}

export async function fetchFinlandCameras(): Promise<CatalogCamera[]> {
  try {
    const res = await stealthFetch('https://tie.digitraffic.fi/api/weathercam/v1/stations', {
      signal: AbortSignal.timeout(12000),
      headers: { 'Digitraffic-User': 'OSIRIS/1.0' },
    });
    if (!res.ok) return [];

    const data = await res.json() as FinlandStations;
    const cams: CatalogCamera[] = [];

    for (const feature of (data.features || [])) {
      const coords = feature.geometry?.coordinates;
      const props = feature.properties;
      if (!coords || coords.length < 2 || !props) continue;

      const presets = props.presets || [];
      if (presets.length === 0) continue;

      // Use the first preset's image URL
      const preset = presets[0];
      const imageUrl = preset.imageUrl || `https://weathercam.digitraffic.fi/${preset.id}.jpg`;

      cams.push({
        id: `fin-${feature.id || props.id}`,
        lat: coords[1],
        lng: coords[0],
        name: props.name || props.names?.fi || 'Finland Weathercam',
        city: props.municipality || 'Finland',
        country: 'Finland',
        feed_url: imageUrl,
        source: 'Fintraffic',
      });
    }

    return cams;
  } catch (e) {
    return [];
  }
}
