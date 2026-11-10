import { NextResponse } from 'next/server';
import { loadReport } from '@/lib/magma';

export const dynamic = 'force-dynamic';

/** ATLAS — the latest MAGMA activity report for one volcano, by its MAGMA code (e.g. KRA). */
export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get('code') ?? '';
  // Only a code goes in; the URL fetched is the signed one MAGMA published for it.
  if (!/^[A-Z]{3}$/.test(code)) return NextResponse.json({ error: 'Kode gunung tidak valid.' }, { status: 400 });
  try {
    const found = await loadReport(code);
    if (!found) return NextResponse.json({ error: 'Laporan tidak ditemukan.' }, { status: 404 });
    return NextResponse.json(found, { headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200' } });
  } catch (error) {
    console.error('Volcano report fetch error:', error);
    return NextResponse.json({ error: 'MAGMA tidak dapat dihubungi.' }, { status: 502 });
  }
}
