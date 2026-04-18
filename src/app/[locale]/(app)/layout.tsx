import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { setRequestLocale } from 'next-intl/server';

import { createSupabaseServerClient } from '@/lib/supabase/server';

import { AppShellLayout } from './AppShellLayout';

export default async function ProtectedLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/${locale}/auth/login`);
  }

  return <AppShellLayout userEmail={user.email ?? null}>{children}</AppShellLayout>;
}
