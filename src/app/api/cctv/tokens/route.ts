import { NextResponse } from 'next/server';
import { canManageUsers } from '@/lib/ops/access';
import { currentUser } from '@/lib/ops/current-user';
import { requestIp, writeAudit } from '@/lib/ops/audit';
import { cctvTokenSource, listCctvTokenStatus, updateStoredCctvToken } from '@/lib/cctv-tokens';
import { clearTptIndex } from '../tpt';
import { clearFlussonicToken } from '../tpt-flussonic';
import { releaseCctvRegion } from '../route';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Masuk diperlukan.' }, { status: 401 });
  if (!canManageUsers(user.role)) return NextResponse.json({ error: 'Peran ini tidak mengubah token.' }, { status: 403 });
  return NextResponse.json({ sources: listCctvTokenStatus() });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Masuk diperlukan.' }, { status: 401 });
  if (!canManageUsers(user.role)) return NextResponse.json({ error: 'Peran ini tidak mengubah token.' }, { status: 403 });

  let body: { id?: unknown; token?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Data token tidak lengkap.' }, { status: 400 });
  }
  const id = typeof body.id === 'string' ? body.id : '';
  const source = cctvTokenSource(id);
  if (!source) return NextResponse.json({ error: 'Sumber token tidak dikenal.' }, { status: 400 });

  let saved: Awaited<ReturnType<typeof updateStoredCctvToken>>;
  try {
    saved = await updateStoredCctvToken(id, body.token);
  } catch (error) {
    console.error(`[OSIRIS] CCTV token update failed: ${source.id}`, error);
    await writeAudit({ action: 'cctv_token_update', result: 'error', actorId: user.id, ip: requestIp(request), detail: source.id });
    return NextResponse.json({ error: 'Token gagal disimpan.' }, { status: 500 });
  }
  if (!saved.ok) {
    await writeAudit({ action: 'cctv_token_update', result: 'rejected', actorId: user.id, ip: requestIp(request), detail: source.id });
    return NextResponse.json({ error: saved.error }, { status: 400 });
  }

  if (source.id === 'jakarta') { clearTptIndex(); clearFlussonicToken(); }
  releaseCctvRegion(source.region);
  await writeAudit({ action: 'cctv_token_update', result: saved.persisted ? 'ok' : 'memory_only', actorId: user.id, ip: requestIp(request), detail: source.id });
  return NextResponse.json({ ok: true, id: source.id, persisted: saved.persisted });
}
