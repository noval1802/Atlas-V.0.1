import { NextResponse } from 'next/server';
import { canManageUsers } from '@/lib/ops/access';
import { currentUser } from '@/lib/ops/current-user';
import { cctvTokenSource, listCctvTokenStatus, updateStoredCctvToken } from '@/lib/cctv-tokens';
import { clearTptIndex } from '../tpt';
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

  const saved = await updateStoredCctvToken(id, body.token);
  if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: 400 });

  if (source.id === 'jakarta') clearTptIndex();
  releaseCctvRegion(source.region);
  console.info(`[OSIRIS] CCTV token updated: ${source.id}`);
  return NextResponse.json({ ok: true, id: source.id });
}
