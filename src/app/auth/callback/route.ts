import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { routing } from '@/i18n/routing';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { origin, searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const nextParam = searchParams.get('next');
  const localeParam = searchParams.get('locale');

  const locale =
    localeParam && routing.locales.includes(localeParam as (typeof routing.locales)[number])
      ? localeParam
      : routing.defaultLocale;

  const safeNext =
    nextParam && nextParam.startsWith('/') ? nextParam : `/${locale}/dashboard`;

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }

  return NextResponse.redirect(`${origin}/${locale}/auth/login?error=auth`);
}
