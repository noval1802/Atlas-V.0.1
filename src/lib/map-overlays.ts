/** A point placed by OSINT geolocation. */
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
