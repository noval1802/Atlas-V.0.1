/** Situation snapshot from the 5 Oct 2026 22:00 karhutla lapsit. */

export const KARHUTLA_LAPSIT_AT = "5 Okt 2026, 22.00";

export interface KarhutlaReport {
  code: string;
  /** Null when the lapsit recorded burned area without a hotspot count. */
  awalTitik: number | null;
  awalHa: number;
  padamTitik: number | null;
  padamHa: number;
  prosesTitik: number | null;
  prosesHa: number;
  personelSiaga: number;
}

function report(
  code: string,
  awalTitik: number,
  awalHa: number,
  padamTitik: number,
  padamHa: number,
  prosesTitik: number,
  prosesHa: number,
  personelSiaga: number,
): KarhutlaReport {
  return { code, awalTitik, awalHa, padamTitik, padamHa, prosesTitik, prosesHa, personelSiaga };
}

/** Burned area that the lapsit says was fully extinguished, with no hotspot split. */
function extinguished(code: string, hectares: number, personelSiaga: number): KarhutlaReport {
  return {
    code,
    awalTitik: null,
    awalHa: hectares,
    padamTitik: null,
    padamHa: hectares,
    prosesTitik: 0,
    prosesHa: 0,
    personelSiaga,
  };
}

const REPORTS: KarhutlaReport[] = [
  report("XXII/TB", 150, 196.96, 83, 104.23, 67, 92.73, 2384),
  report("II/SWJ", 58, 175.4, 26, 166.3, 32, 9.1, 3013),
  report("XXI/RI", 2, 54, 0, 33, 2, 21, 3021),
  report("XVIII/KSR", 2, 8, 0, 6, 2, 2, 8790),
  report("XX/TIB", 6, 49, 5, 47, 1, 2, 6659),
  report("IV/DIP", 2, 1.5, 1, 1, 1, 0.5, 1200),
  extinguished("XII/TPR", 30.5, 5400),
  extinguished("VI/MLW", 9.8, 5269),
  extinguished("XIV/HSN", 20, 4874),
  extinguished("IX/UDY", 111.3, 2737),
  extinguished("XV/PTM", 3.5, 3000),
  extinguished("V/BRW", 2.32, 3140),
  extinguished("XXIII/PW", 2, 4359),
  extinguished("XXIV/MT", 0.56, 1729),
];

const BY_CODE = new Map(REPORTS.map((item) => [item.code, item]));

export function karhutlaReport(code: string): KarhutlaReport | null {
  return BY_CODE.get(code) ?? null;
}

export function karhutlaReports(): KarhutlaReport[] {
  return REPORTS;
}

function hectares(value: number): string {
  return `${value.toLocaleString("id-ID", { maximumFractionDigits: 2 })} Ha`;
}

export function formatKarhutlaAmount(titik: number | null, ha: number): string {
  if (titik === 0 && ha === 0) return "0";
  const area = hectares(ha);
  if (titik === null) return area;
  return `${titik.toLocaleString("id-ID")} titik · ${area}`;
}

export function formatPersonel(value: number): string {
  return value.toLocaleString("id-ID");
}
