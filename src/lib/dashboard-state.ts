/** Counts from `/api/stats`. The header stores them; nothing else reads them yet. */
export interface GlobalStats {
  cctv: number;
  weather: number;
  incidents: number;
}

/** The fields the region dossier card reads. Missing pieces stay blank. */
export interface RegionDossier {
  location?: { display_name?: string };
  country?: {
    flag?: string;
    name?: string;
    capital?: string;
    population?: number;
    subregion?: string;
    region?: string;
    languages?: string[];
    area?: number;
  } | null;
  head_of_state?: { name?: string; position?: string } | null;
  wikipedia?: { thumbnail?: string; extract?: string } | null;
}

/** A camera the viewer can open from a map click or a preview tile. */
export interface WatchedCamera {
  id?: string | number;
  name?: string;
  city?: string;
  country?: string;
  source?: string;
  feed_url?: string;
  stream_url?: string;
  stream_type?: string;
  external_url?: string;
  lat: number;
  lng: number;
}

export type MapEntity =
  | (WatchedCamera & { type: 'cctv' })
  | {
      type: 'live_news';
      name?: string;
      city?: string;
      country?: string;
      url?: string;
      category?: string;
      embed_allowed?: boolean;
    };

/** The fields OsirisMap reads after the page drops hidden layers. */
export type ArcGisMapLayer = Pick<ArcGisLayer, 'id' | 'title' | 'geojson' | 'color' | 'opacity'>;

/** One ArcGIS feature collection the map draws as its own source. */
export interface ArcGisLayer {
  id: string;
  title: string;
  url: string;
  geojson: GeoJSON.GeoJSON;
  color: string;
  visible: boolean;
  opacity: number;
}
