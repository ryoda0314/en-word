import {
  Badge,
  Card,
  Group,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { BookOpen, Dumbbell, Target } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { LinkButton } from '@/components/common/LinkButton';
import { LinkCard } from '@/components/common/LinkCard';
import { StageBadge } from '@/components/vocab/StageBadge';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { VocabStage } from '@/types/db';

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('dashboard');

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const now = new Date();
  const thirtyAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [statsRes, eventsRes, recentVocabRes, strugglingRes] = await Promise.all([
    supabase.rpc('vocab_stats'),
    supabase
      .from('review_events')
      .select('created_at')
      .eq('user_id', user.id)
      .gte('created_at', thirtyAgo.toISOString()),
    supabase
      .from('user_vocab')
      .select(
        `id, stage, created_at, custom_term,
         word:words(lemma, meaning_ja),
         idiom:idioms(phrase, meaning_ja)`,
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('user_vocab')
      .select('id')
      .eq('user_id', user.id)
      .neq('stage', 'mastered')
      .gt('lapses', 0),
  ]);

  const raw = Array.isArray(statsRes.data) ? statsRes.data[0] : statsRes.data;
  const stats = {
    total: Number(raw?.total_count ?? 0),
    due: Number(raw?.due_today_count ?? 0),
    mastered: Number(raw?.mastered_count ?? 0),
  };

  // Streak = consecutive days up to and including today with at least one review event.
  const daySet = new Set<string>();
  for (const e of eventsRes.data ?? []) {
    daySet.add(isoDay(new Date(e.created_at)));
  }
  let streak = 0;
  const cursor = new Date(now);
  cursor.setUTCHours(0, 0, 0, 0);
  while (daySet.has(isoDay(cursor))) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  const strugglingCount = strugglingRes.data?.length ?? 0;
  const recentVocab = (recentVocabRes.data ?? []) as Array<{
    id: string;
    stage: VocabStage;
    created_at: string;
    custom_term: string | null;
    word: { lemma: string; meaning_ja: string | null } | null;
    idiom: { phrase: string; meaning_ja: string | null } | null;
  }>;

  return (
    <Stack gap="lg">
      <Stack gap={4}>
        <Title order={2}>{t('title')}</Title>
        <Text c="dimmed" size="sm">
          {t('subtitle')}
        </Text>
      </Stack>

      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
        <StatCard label={t('stats.dueToday')} value={stats.due} accent={stats.due > 0 ? 'indigo' : undefined} />
        <StatCard label={t('stats.streak')} value={streak} suffix={streak > 0 ? t('days') : undefined} />
        <StatCard label={t('stats.totalVocab')} value={stats.total} />
        <StatCard label={t('stats.mastered')} value={stats.mastered} />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <ActionCard
          icon={<Target size={20} />}
          title={t('actions.reviewTitle')}
          body={
            stats.due > 0
              ? t('actions.reviewBody', { count: stats.due })
              : t('actions.reviewAllClear')
          }
          cta={stats.due > 0 ? t('actions.startReview') : t('actions.allClear')}
          href="/review"
          disabled={stats.due === 0}
          color="indigo"
        />
        <ActionCard
          icon={<Dumbbell size={20} />}
          title={t('actions.drillTitle')}
          body={
            strugglingCount > 0
              ? t('actions.drillBody', { count: strugglingCount })
              : t('actions.drillEmpty')
          }
          cta={strugglingCount > 0 ? t('actions.startDrill') : t('actions.noDrill')}
          href="/drill"
          disabled={strugglingCount === 0}
          color="grape"
        />
      </SimpleGrid>

      <Card withBorder radius="md" p="lg">
        <Stack gap="md">
          <Group justify="space-between">
            <Stack gap={2}>
              <Text fw={600}>{t('recent.title')}</Text>
              <Text c="dimmed" size="xs">
                {t('recent.subtitle')}
              </Text>
            </Stack>
            <LinkButton
              href="/read"
              size="xs"
              variant="subtle"
              leftSection={<BookOpen size={14} />}
            >
              {t('recent.browse')}
            </LinkButton>
          </Group>
          {recentVocab.length === 0 ? (
            <Text c="dimmed" size="sm">
              {t('recent.empty')}
            </Text>
          ) : (
            <Stack gap="xs">
              {recentVocab.map((r) => {
                const name = r.word?.lemma ?? r.idiom?.phrase ?? r.custom_term ?? '';
                const meaning =
                  r.word?.meaning_ja ?? r.idiom?.meaning_ja ?? '';
                return (
                  <LinkCard
                    key={r.id}
                    href={`/vocab/${r.id}`}
                    withBorder
                    radius="sm"
                    p="sm"
                  >
                    <Group justify="space-between" wrap="nowrap">
                      <Stack gap={0} style={{ minWidth: 0, flex: 1 }}>
                        <Text fw={500} size="sm" truncate>
                          {name}
                        </Text>
                        {meaning ? (
                          <Text size="xs" c="dimmed" truncate>
                            {meaning}
                          </Text>
                        ) : null}
                      </Stack>
                      <StageBadge stage={r.stage} size="xs" />
                    </Group>
                  </LinkCard>
                );
              })}
            </Stack>
          )}
        </Stack>
      </Card>
    </Stack>
  );
}

function StatCard({
  label,
  value,
  suffix,
  accent,
}: {
  label: string;
  value: number;
  suffix?: string;
  accent?: 'indigo';
}) {
  return (
    <Card withBorder radius="md" p="lg">
      <Stack gap={4}>
        <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
          {label}
        </Text>
        <Group gap={4} align="baseline">
          <Text
            fz={32}
            fw={700}
            lh={1}
            c={accent === 'indigo' && value > 0 ? 'indigo' : undefined}
          >
            {value}
          </Text>
          {suffix ? (
            <Text size="xs" c="dimmed">
              {suffix}
            </Text>
          ) : null}
        </Group>
      </Stack>
    </Card>
  );
}

function ActionCard({
  icon,
  title,
  body,
  cta,
  href,
  disabled,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  cta: string;
  href: string;
  disabled?: boolean;
  color?: 'indigo' | 'grape';
}) {
  return (
    <Card withBorder radius="md" p="lg">
      <Stack gap="sm">
        <Group gap="xs" align="center">
          <Badge color={color} variant="light" size="lg" radius="sm" p={6}>
            {icon}
          </Badge>
          <Text fw={600}>{title}</Text>
        </Group>
        <Text c="dimmed" size="sm">
          {body}
        </Text>
        <LinkButton
          href={href}
          size="sm"
          variant={disabled ? 'default' : 'filled'}
          color={color}
          disabled={disabled}
          mt="xs"
        >
          {cta}
        </LinkButton>
      </Stack>
    </Card>
  );
}
