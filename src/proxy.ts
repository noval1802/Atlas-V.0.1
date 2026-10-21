import { NextResponse } from 'next/server';
import type { NextRequest, NextFetchEvent } from 'next/server';
import { canManageUsers, deniedPage } from './lib/ops/access';
import { isAdminApi, isProtectedPage, isPublicApi, sessionAccount } from './lib/ops/gate';
import { OPS_COOKIE } from './lib/ops/session';
import { trackPageView } from './lib/umami-analytics';

export async function proxy(request: NextRequest, event: NextFetchEvent) {
  const path = request.nextUrl.pathname;

  /* API routes skip analytics. The page matcher used to exclude them so a
     CCTV fetch was not stuck behind the Umami timeout. Auth still runs here,
     and a missing session answers 401 before the route reads a feed. */
  if (path.startsWith('/api/')) {
    if (isPublicApi(path, request.method)) return NextResponse.next();
    const account = await sessionAccount(request.cookies.get(OPS_COOKIE)?.value);
    if (!account) return NextResponse.json({ error: 'Masuk diperlukan.' }, { status: 401 });
    if (isAdminApi(path) && !canManageUsers(account.role)) {
      return NextResponse.json({ error: 'Peran ini tidak memiliki izin.' }, { status: 403 });
    }
    return NextResponse.next();
  }

  trackPageView(request, event);

  if (isProtectedPage(path)) {
    const account = await sessionAccount(request.cookies.get(OPS_COOKIE)?.value);
    if (!account) {
      const login = request.nextUrl.clone();
      login.pathname = '/masuk';
      login.search = '';
      const next = path.startsWith('/pengguna') ? '/pengguna' : path.startsWith('/operator') ? '/operator' : '/peta';
      const layers = next === '/peta' ? request.nextUrl.searchParams.get('layers') : null;
      login.searchParams.set('next', layers && layers.length <= 500 && !/[\r\n]/.test(layers) ? `${next}?layers=${layers}` : next);
      return NextResponse.redirect(login);
    }
    const bounce = deniedPage(path, account.role);
    if (bounce) {
      const dest = request.nextUrl.clone();
      dest.pathname = bounce;
      dest.search = '';
      return NextResponse.redirect(dest);
    }
  }

  return NextResponse.next();
}

/* Assets are excluded, not just pages. MapLibre 6 loads its worker from
   /vendor/maplibre/<version>/ at runtime, and the basemap style from
   /dark-matter-style.json — neither is under _next/static, so both used to
   match here and pay two umami round trips before the map could start. That is
   the same starvation that 2f375dd fixed for the CCTV routes, moved onto the
   map's critical path. Analytics wants page views; asset fetches are not one. */
export const config = {
  matcher: [
    '/api/:path*',
    '/((?!api|_next/static|_next/image|vendor|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mjs|js|css|json|pbf|mvt|woff|woff2|ico|txt)$).*)',
  ],
}
