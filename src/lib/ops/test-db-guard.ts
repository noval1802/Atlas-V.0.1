/**
 * Database tests run only against the throwaway osiris_ops_test on localhost, so a
 * mistyped TEST_DATABASE_URL can never wipe the working osiris_ops.
 */
export function assertTestDatabase(raw: string): void {
  const parsed = new URL(raw);
  if (parsed.pathname !== "/osiris_ops_test" || !["127.0.0.1", "localhost"].includes(parsed.hostname)) {
    throw new Error("TEST_DATABASE_URL must point at osiris_ops_test on localhost.");
  }
}
