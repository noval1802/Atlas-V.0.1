/** A conflict-zone anchor as the map popup reads it. */
export interface ConflictZonePoint {
  label?: string;
  severity?: string;
  lat?: number;
  lng?: number;
  description?: string;
  sourceUrl?: string;
  eventCount?: number;
}

/** One live conflict event plotted beside the zone anchors. */
export interface ConflictLiveEvent {
  lat?: number;
  lng?: number;
  title?: string;
  url?: string;
}

export interface ConflictFeed {
  zones: ConflictZonePoint[];
  liveEvents: ConflictLiveEvent[];
}

/**
 * The `/api/conflicts` body. A missing or non-array list is empty, so a bad
 * payload does not throw inside the map effect.
 */
export function conflictFeed(body: unknown): ConflictFeed {
  if (!body || typeof body !== 'object') return { zones: [], liveEvents: [] };
  const record = body as { zones?: unknown; liveEvents?: unknown };
  return {
    zones: Array.isArray(record.zones) ? record.zones as ConflictZonePoint[] : [],
    liveEvents: Array.isArray(record.liveEvents) ? record.liveEvents as ConflictLiveEvent[] : [],
  };
}

/** A point placed by OSINT geolocation or the World Remote panel. */
export interface ScanTarget {
  id: string;
  lat: number;
  lng: number;
  name?: string;
  type?: string;
  color?: string;
  timestamp?: number;
  source?: string;
  region?: string;
  city?: string;
  country?: string;
  isp?: string;
  org?: string;
  as?: string;
}
