import { PrismaClient } from "@prisma/client";

const globalForOps = globalThis as { opsPrisma?: PrismaClient };

export function opsDb(): PrismaClient {
  if (!globalForOps.opsPrisma) globalForOps.opsPrisma = new PrismaClient();
  return globalForOps.opsPrisma;
}
