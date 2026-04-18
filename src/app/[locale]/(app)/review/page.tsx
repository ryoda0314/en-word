import { Badge, Card, Group, Stack, Text, Title } from '@mantine/core';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { LinkButton } from '@/components/common/LinkButton';
import { StageBadge } from '@/components/vocab/StageBadge';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { VocabStage } from '@/types/db';

export default async function ReviewEntryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('review');

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: dueRows } = await supabase
    .from('user_vocab')
    .select('stage')
    .eq('user_id', user.id)
    .neq('stage', 'mastered')
    .lte('next_review_at', new Date().toISOString());

  const total = dueRows?.length ?? 0;
  const countsByStage: Record<VocabStage, number> = {
    memorize: 0,
    recognize: 0,
    produce: 0,
    mastered: 0,
  };
  for (const r of dueRows ?? []) countsByStage[r.stage as VocabStage] += 1;

  return (
    <Stack gap="lg" maw={560}>
      <Stack gap={4}>
        <Title order={2}>{t('title')}</Title>
        <Text c="dimmed" size="sm">
          {t('entrySubtitle')}
        </Text>
      </Stack>

      {total === 0 ? (
        <Card withBorder radius="md" p="lg">
          <Stack gap="xs">
            <Title order={3} size="h4">
              {t('allClearTitle')}
            </Title>
            <Text c="dimmed" size="sm">
              {t('allClearBody')}
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
                {t('cardsDue')}
              </Text>
            </Group>
            <Group gap="xs">
              {(['memorize', 'recognize', 'produce'] as VocabStage[]).map((s) =>
                countsByStage[s] > 0 ? (
                  <Badge
                    key={s}
                    color={
                      s === 'memorize'
                        ? 'gray'
                        : s === 'recognize'
                          ? 'indigo'
                          : 'teal'
                    }
                    variant="light"
                    size="lg"
                  >
                    <Group gap={4}>
                      <StageBadge stage={s} size="xs" />
                      <Text size="xs" fw={600}>
                        {countsByStage[s]}
                      </Text>
                    </Group>
                  </Badge>
                ) : null,
              )}
            </Group>
            <LinkButton href="/review/session" size="md" mt="xs">
              {t('start')}
            </LinkButton>
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
