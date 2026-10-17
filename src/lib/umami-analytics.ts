const WEBSITE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type UmamiRequest = {
  headers: { get(name: string): string | null };
  nextUrl: { pathname: string; hostname: string };
};

export type UmamiEvent = {
  waitUntil(task: Promise<unknown>): void;
};

/** A configured website id. Empty and non-UUID values are not a configuration. */
export function configuredUmamiWebsiteId(raw: string | undefined | null): string | null {
  const value = raw?.trim() ?? '';
  if (!WEBSITE_ID.test(value)) return null;
  return value;
}

/**
 * Collector for this deployment. None is configured, and the retired compose
 * hostname is not a stand-in. Callers must not invent one.
 */
export function umamiCollectUrl(): null {
  return null;
}

/**
 * Page views stay local until the owner has both a website id and a collector.
 * A missing id, an invalid id, or a missing host sends nothing, including the
 * client address.
 */
export function trackPageView(_request: UmamiRequest, _event: UmamiEvent): void {
  const website = configuredUmamiWebsiteId(process.env.UMAMI_WEBSITE_ID);
  if (!website || !umamiCollectUrl()) return;
}
