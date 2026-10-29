import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

/** Same format as src/lib/ops/password.ts hashPassword, so the app can verify it. */
export async function hashPassword(password) {
  const salt = randomBytes(16).toString("base64url");
  const hash = await scryptAsync(password, salt, 32);
  return `scrypt$${salt}$${hash.toString("base64url")}`;
}
