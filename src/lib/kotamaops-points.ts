/** Matra yang punya Kotamaops di peta; tiap matra satu toggle layer. */
export type Matra = "AD" | "AL" | "AU";

export const MATRA_LAYER = { AD: "tni_ad", AL: "tni_al", AU: "tni_au" } as const satisfies Record<Matra, string>;

/** Satu markas Kotamaops dari tabel Kotamaops (lihat prisma/seed.mjs). */
export interface KotamaopsPoint {
  code: string;
  name: string;
  region: string;
  location: string;
  lat: number;
  lng: number;
  matra: Matra;
  /** Path lambang di /public; kosong = perisai bawaan. */
  logo: string;
}

/** MapLibre image id for a unit crest. */
export function kotamaopsIconId(code: string): string {
  return `kotamaops-${code.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

/** Hanya lambang lokal di /kodam/ yang dipakai, karena nilainya berasal dari database. */
export function safeKotamaopsLogo(logo: string): string {
  return /^\/kodam\/[a-z0-9-]+\.png$/.test(logo) ? logo : "";
}

export function kotamaopsFeatures(points: KotamaopsPoint[], visible: (matra: Matra) => boolean) {
  return points
    .filter((point) => visible(point.matra))
    .map((point) => {
      const logo = safeKotamaopsLogo(point.logo);
      return {
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [point.lng, point.lat] as [number, number] },
        properties: {
          code: point.code,
          name: point.name,
          region: point.region,
          location: point.location,
          matra: point.matra,
          icon: logo ? kotamaopsIconId(point.code) : "kotamaops-shield",
          logo,
        },
      };
    });
}
