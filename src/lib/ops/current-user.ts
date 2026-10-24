import { cookies } from "next/headers";
import type { Kotamaops, User } from "@prisma/client";
import { sessionMatchesUser } from "./access";
import { opsDb } from "./db";
import { OPS_COOKIE, readSession, sessionSecret } from "./session";

export type CurrentUser = User & { kotamaops: Kotamaops | null };

export async function currentUser(): Promise<CurrentUser | null> {
  const secret = sessionSecret();
  const token = (await cookies()).get(OPS_COOKIE)?.value;
  const session = await readSession(token, secret);
  if (!session) return null;
  const user = await opsDb().user.findUnique({ where: { id: session.sub }, include: { kotamaops: true } });
  if (!user || !sessionMatchesUser(session, user)) return null;
  return user;
}

type AccountRow = User & { kotamaops?: { id: string; code: string; name: string } | null };

export function presentUser(user: AccountRow) {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    organization: user.organization,
    position: user.position,
    role: user.role,
    active: user.active,
    accountStatus: user.accountStatus,
    kotamaopsId: user.kotamaopsId,
    kotamaops: user.kotamaops ? { id: user.kotamaops.id, code: user.kotamaops.code, name: user.kotamaops.name } : null,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

export function publicUser(user: CurrentUser) {
  return presentUser(user);
}
