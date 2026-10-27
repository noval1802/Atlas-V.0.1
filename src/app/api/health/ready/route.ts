import { NextResponse } from 'next/server';
import { opsDb } from '@/lib/ops/db';

export const dynamic = 'force-dynamic';

const DB_TIMEOUT_MS = 3000;

/**
 * Readiness for the container healthcheck: can this process serve a logged-in user?
 *
 * /api/health answers "the process is up" and the operator dashboard reads it as such.
 * Every session lookup needs Postgres, so a process without it logs everyone out;
 * this route says so with a 503 instead of a healthy-looking 200. The database
 * error itself is not returned.
 */
export async function GET() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const database = await Promise.race([
    opsDb().$queryRaw`SELECT 1`.then(() => 'ok' as const),
    new Promise<'timeout'>(resolve => { timer = setTimeout(() => resolve('timeout'), DB_TIMEOUT_MS); }),
  ]).catch(() => 'unreachable' as const).finally(() => clearTimeout(timer));

  const ready = database === 'ok';
  return NextResponse.json(
    { status: ready ? 'ready' : 'not_ready', database, timestamp: new Date().toISOString() },
    { status: ready ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
