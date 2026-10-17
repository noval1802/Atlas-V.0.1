/** Headquarters copied from the ATLAS Kodam table into OSIRIS Kotamaops. */
export interface KotamaopsPoint {
  code: string;
  name: string;
  region: string;
  location: string;
  lat: number;
  lng: number;
}

/** Crests already stored for these units. Kodaeral V comes from the ATLAS upload. */
export const KOTAMAOPS_LOGOS: Record<string, string> = {
  "JAYA": "/kodam/jaya.png",
  "I/BB": "/kodam/i-bb.png",
  "IM": "/kodam/im.png",
  "II/SWJ": "/kodam/ii-swj.png",
  "III/SLW": "/kodam/iii-slw.png",
  "IV/DIP": "/kodam/iv-dip.png",
  "V/BRW": "/kodam/v-brw.png",
  "VI/MLW": "/kodam/vi-mlw.png",
  "IX/UDY": "/kodam/ix-udy.png",
  "XII/TPR": "/kodam/xii-tpr.png",
  "XIII/MDK": "/kodam/xiii-mdk.png",
  "XIV/HSN": "/kodam/xiv-hsn.png",
  "XV/PTM": "/kodam/xv-ptm.png",
  "XVII/CEN": "/kodam/xvii-cen.png",
  "XVIII/KSR": "/kodam/xviii-ksr.png",
  "XIX/TT": "/kodam/xix-tt.png",
  "XX/TIB": "/kodam/xx-tib.png",
  "XXI/RI": "/kodam/xxi-ri.png",
  "XXII/TB": "/kodam/xxii-tb.png",
  "XXIII/PW": "/kodam/xxiii-pw.png",
  "XXIV/MT": "/kodam/xxiv-mt.png",
  "KODAERAL V": "/kodam/kodaeral-v.png",
};

/** MapLibre image id for a unit crest. */
export function kotamaopsIconId(code: string): string {
  return `kotamaops-${code.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

export function kotamaopsLogo(code: string): string {
  return KOTAMAOPS_LOGOS[code] ?? "";
}

/**
 * The 21 bundled ATLAS rows, plus Kodaeral V, which lives in the ATLAS
 * database and is absent from atlas/src/data/kodam.ts. Numbers are the stored
 * ATLAS values, not the rounded figures in that file.
 */
export const KOTAMAOPS_POINTS: KotamaopsPoint[] = [
  { code: "JAYA", name: "Kodam Jaya", region: "DKI Jakarta", location: "Jakarta", lat: -6.2, lng: 106.82 },
  { code: "I/BB", name: "Kodam I/BB", region: "Sumatera Utara", location: "Medan", lat: 3.59358, lng: 98.622275 },
  { code: "IM", name: "Kodam IM", region: "Aceh", location: "Banda Aceh", lat: 5.555816, lng: 95.320432 },
  { code: "II/SWJ", name: "Kodam II/SWJ", region: "Sumatera Selatan", location: "Palembang", lat: -2.970204, lng: 104.749884 },
  { code: "III/SLW", name: "Kodam III/SLW", region: "Jawa Barat", location: "Bandung", lat: -6.909348, lng: 107.613295 },
  { code: "IV/DIP", name: "Kodam IV/DIP", region: "Jawa Tengah", location: "Semarang", lat: -7.085942, lng: 110.407235 },
  { code: "V/BRW", name: "Kodam V/BRW", region: "Jawa Timur", location: "Surabaya", lat: -7.298221, lng: 112.722126 },
  { code: "VI/MLW", name: "Kodam VI/MLW", region: "Kalimantan Timur", location: "Balikpapan", lat: -1.24, lng: 116.85 },
  { code: "IX/UDY", name: "Kodam IX/UDY", region: "Bali dan Nusa Tenggara", location: "Denpasar", lat: -8.656989, lng: 115.216424 },
  { code: "XII/TPR", name: "Kodam XII/TPR", region: "Kalimantan Barat", location: "Kubu Raya", lat: -0.02, lng: 109.34 },
  { code: "XIII/MDK", name: "Kodam XIII/MDK", region: "Sulawesi Utara", location: "Manado", lat: 1.47, lng: 124.84 },
  { code: "XIV/HSN", name: "Kodam XIV/HSN", region: "Sulawesi Selatan", location: "Makassar", lat: -5.15, lng: 119.43 },
  { code: "XV/PTM", name: "Kodam XV/PTM", region: "Maluku", location: "Ambon", lat: -3.7, lng: 128.18 },
  { code: "XVII/CEN", name: "Kodam XVII/CEN", region: "Papua", location: "Jayapura", lat: -2.59, lng: 140.67 },
  { code: "XVIII/KSR", name: "Kodam XVIII/KSR", region: "Papua Barat", location: "Manokwari", lat: -0.86, lng: 134.06 },
  { code: "XIX/TT", name: "Kodam XIX/TT", region: "Riau", location: "Pekanbaru", lat: 0.51, lng: 101.45 },
  { code: "XX/TIB", name: "Kodam XX/TIB", region: "Sumatera Barat", location: "Padang", lat: -0.95, lng: 100.35 },
  { code: "XXI/RI", name: "Kodam XXI/RI", region: "Lampung", location: "Bandar Lampung", lat: -5.43, lng: 105.26 },
  { code: "XXII/TB", name: "Kodam XXII/TB", region: "Kalimantan Tengah", location: "Palangkaraya", lat: -2.21, lng: 113.92 },
  { code: "XXIII/PW", name: "Kodam XXIII/PW", region: "Sulawesi Tengah", location: "Sigi / Palu", lat: -0.9, lng: 119.87 },
  { code: "XXIV/MT", name: "Kodam XXIV/MT", region: "Papua Selatan", location: "Merauke", lat: -8.49, lng: 140.4 },
  { code: "KODAERAL V", name: "Kodaeral V", region: "Surabaya", location: "Surabaya", lat: -7.213222, lng: 112.724934 },
];

export function kotamaopsFeatures(visible: boolean) {
  if (!visible) return [];
  return KOTAMAOPS_POINTS.map((point) => ({
    type: "Feature" as const,
    geometry: { type: "Point" as const, coordinates: [point.lng, point.lat] as [number, number] },
    properties: {
      code: point.code,
      name: point.name,
      region: point.region,
      location: point.location,
      icon: kotamaopsLogo(point.code) ? kotamaopsIconId(point.code) : "kotamaops-shield",
      logo: kotamaopsLogo(point.code),
    },
  }));
}
