/** Titik tengah NKRI (Sabang–Merauke ±46° bujur). Peta operasi selalu dibuka di sini. */
export const NKRI_CENTER = { lat: -2.5, lng: 118 } as const;

const NKRI_SPAN_LNG = 46;

/** Zoom yang memuat seluruh NKRI pada lebar layar ini (85% lebar, tile 512 px), dibatasi 2–5. */
export function nkriZoom(viewportWidth: number): number {
  const zoom = Math.log2((viewportWidth * 0.85 * 360) / (NKRI_SPAN_LNG * 512));
  return Math.round(Math.max(2, Math.min(5, zoom)) * 10) / 10;
}
