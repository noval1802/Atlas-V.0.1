import type { AlertPinReport, MapData, NewsRow, NewsSourceHealth } from '@/lib/map-data';

/* /api/news answers with its own `timestamp` and `total`; merged at the root
   they would be overwritten by the next endpoint, so the feed keeps its
   metadata under its own key. */
export function newsTransform(payload: unknown): Partial<MapData> {
  const d = payload as { news?: NewsRow[]; sources?: NewsSourceHealth[]; timestamp?: string };
  return {
    news: d.news,
    news_meta: { sources: d.sources ?? [], fetchedAt: d.timestamp ?? null },
    /* The reports that resolved to a place they name — the Live Alert Pins layer. */
    alert_pins: (d.news ?? []).filter(n => Boolean((n as { place?: unknown }).place)) as AlertPinReport[],
  };
}
