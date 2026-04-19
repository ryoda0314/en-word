import createIntlMiddleware from 'next-intl/middleware';
import { type NextRequest, NextResponse } from 'next/server';

import { routing } from './i18n/routing';
import { updateSupabaseSession } from './lib/supabase/proxy';

const handleI18nRouting = createIntlMiddleware(routing);

export default async function proxy(request: NextRequest) {
  // OAuth callback etc. live outside the locale segment.
  if (request.nextUrl.pathname.startsWith('/auth/')) {
    return updateSupabaseSession(request, NextResponse.next({ request }));
  }

  const intlResponse = handleI18nRouting(request);
  return updateSupabaseSession(request, intlResponse);
}

export const config = {
  // Skip API, Next.js internals, Vercel preview routes, dynamic/static metadata
  // files (icon, apple-icon, robots, sitemap, manifest.webmanifest…), and any
  // path containing a dot (files with extensions).
  matcher: [
    '/((?!api|_next|_vercel|icon|apple-icon|robots|sitemap|opengraph-image|twitter-image|.*\\..*).*)',
  ],
};
