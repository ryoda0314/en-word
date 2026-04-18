import { Card, Group, Stack, Text, Title } from '@mantine/core';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { LinkButton } from '@/components/common/LinkButton';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function DrillEntryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('drill');

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: rows } = await supabase
    .from('user_vocab')
    .select('id, lapses, stage')
    .eq('user_id', user.id)
    .neq('stage', 'mastered')
    .gt('lapses', 0)
    .limit(100);

  const total = rows?.length ?? 0;
  const totalLapses = (rows ?? []).reduce((sum, r) => sum + Number(r.lapses ?? 0), 0);

  return (
    <Stack gap="lg" maw={560}>
      <Stack gap={4}>
        <Title order={2}>{t('title')}</Title>
        <Text c="dimmed" size="sm">
          {t('subtitle')}
        </Text>
      </Stack>

      {total === 0 ? (
        <Card withBorder radius="md" p="lg">
          <Stack gap="xs">
            <Title order={3} size="h4">
              {t('emptyTitle')}
            </Title>
            <Text c="dimmed" size="sm">
              {t('emptyBody')}
            </Text>
          </Stack>
        </Card>
      ) : (
        <Card withBorder radius="md" p="lg">
          <Stack gap="md">
            <Group gap="xs" align="flex-end">
              <Text fz={40} fw={700} lh={1}>
                {total}
              </Text>
              <Text c="dimmed" pb={6}>
                {t('itemsToRedo')}
              </Text>
            </Group>
            <Text size="sm" c="dimmed">
              {t('lapseSummary', { lapses: totalLapses })}
            </Text>
            <LinkButton href="/drill/session" size="md" color="grape" mt="xs">
              {t('start')}
            </LinkButton>
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
