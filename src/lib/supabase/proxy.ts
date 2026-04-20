import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

import type { Database } from '@/types/database';

export async function updateSupabaseSession(
  request: NextRequest,
  response: NextResponse,
) {
  let result = response;

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          // Recreate the response AFTER request.cookies is updated so that
          // NextResponse.next({ request }) forwards the refreshed JWT to Server
          // Components via x-middleware-request-cookie. Skip recreation for
          // redirects — server components don't run on redirects, and the
          // browser receives the new tokens via Set-Cookie.
          if (!result.headers.has('location')) {
            const next = NextResponse.next({ request });
            for (const [k, v] of result.headers.entries()) {
              if (k === 'x-middleware-request-cookie') continue;
              k === 'set-cookie'
                ? next.headers.append(k, v)
                : next.headers.set(k, v);
            }
            result = next;
          }
          for (const { name, value, options } of cookiesToSet) {
            result.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  await supabase.auth.getUser();
  return result;
}
