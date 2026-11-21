import type { Kotamaops, Situation } from "@prisma/client";
import { checkLogo, type LogoKind } from "@/lib/ops/kotamaops-logo";

/** One unit as the Kelola Kotamaops panel sees it. */
export function presentUnit(unit: Kotamaops & { situation: Situation | null; _count?: { users: number } }) {
  return {
    id: unit.id,
    code: unit.code,
    name: unit.name,
    region: unit.region,
    location: unit.location,
    latitude: unit.latitude,
    longitude: unit.longitude,
    matra: unit.matra,
    logo: unit.logo,
    situationId: unit.situation?.id ?? null,
    boundUsers: unit._count?.users ?? 0,
  };
}

export type UnitView = ReturnType<typeof presentUnit>;

/** Same shape as the dashboard's SituationRow. */
export function presentSituation(situation: Situation & { kotamaops: Kotamaops }) {
  return {
    id: situation.id,
    code: situation.kotamaops.code,
    name: situation.kotamaops.name,
    region: situation.kotamaops.region,
    location: situation.kotamaops.location,
    status: situation.status,
    personnel: situation.personnel,
    deployed: situation.deployed,
    incidentCount: situation.incidentCount,
    note: situation.note,
    updatedByName: situation.updatedByName,
    updatedAt: situation.updatedAt.toISOString(),
  };
}

/**
 * Reads the multipart form: text fields for parseNewKotamaops, plus the logo action.
 * An empty file input means "keep the logo"; removeLogo=1 means "clear it".
 */
export async function readUnitForm(request: Request): Promise<
  | { ok: true; fields: Record<string, string>; logo: { bytes: Uint8Array; kind: LogoKind } | null; removeLogo: boolean }
  | { ok: false; error: string }
> {
  const form = await request.formData().catch(() => null);
  if (!form) return { ok: false, error: "Data Kotamaops tidak lengkap." };
  const fields: Record<string, string> = {};
  for (const [key, value] of form.entries()) if (typeof value === "string") fields[key] = value;
  const file = form.get("logo");
  let logo = null;
  if (file instanceof File && file.size > 0) {
    const checked = await checkLogo(file);
    if (!checked.ok) return { ok: false, error: checked.error };
    logo = { bytes: checked.bytes, kind: checked.kind };
  }
  return { ok: true, fields, logo, removeLogo: fields.removeLogo === "1" };
}
