import { Stack, Text, Title } from '@mantine/core';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { AllowlistManager } from '@/components/admin/AllowlistManager';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';

export default async function AdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('admin');

  const supabase = await createSupabaseServerClient();
  const { data: isAdmin } = await supabase.rpc('is_admin' as never);
  if (!isAdmin) notFound();

  const service = createSupabaseServiceClient();
  // `allowlist` was added in migration 20260418000002; re-run `npm run db:types`
  // after applying it to drop this cast.
  const { data: entries } = (await service
    .from('allowlist' as never)
    .select('email, note, created_at')
    .order('created_at', { ascending: false })) as {
    data:
      | Array<{ email: string; note: string | null; created_at: string }>
      | null;
  };

  return (
    <Stack gap="lg" maw={720}>
      <Stack gap={4}>
        <Title order={2}>{t('title')}</Title>
        <Text c="dimmed" size="sm">
          {t('subtitle')}
        </Text>
      </Stack>
      <AllowlistManager initialEntries={entries ?? []} />
    </Stack>
  );
}
