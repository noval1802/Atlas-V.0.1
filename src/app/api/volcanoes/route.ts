import { NextResponse } from 'next/server';
import { loadVolcanoes } from '@/lib/magma';

/** ATLAS — Indonesian volcanoes and their PVMBG activity level (MAGMA). */

export async function GET() {
  try {
    const volcanoes = await loadVolcanoes();
    return NextResponse.json({
      volcanoes,
      source: 'MAGMA Indonesia / PVMBG',
      timestamp: new Date().toISOString(),
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200' },
    });
  } catch (error) {
    console.error('Volcano fetch error:', error);
    return NextResponse.json({ volcanoes: [], error: 'MAGMA unavailable' }, { status: 502 });
  }
}
