import {
  Badge,
  Card,
  Group,
  Paper,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import {
  BookOpen,
  CalendarDays,
  Dumbbell,
  Flame,
  Layers,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';
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
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);

  const [statsRes, eventsRes, profileRes, recentVocabRes, strugglingRes] =
    await Promise.all([
      supabase.rpc('vocab_stats'),
      supabase
        .from('review_events')
        .select('created_at')
        .eq('user_id', user.id)
        .gte('created_at', thirtyAgo.toISOString()),
      supabase
        .from('profiles')
        .select('display_name, daily_goal')
        .eq('user_id', user.id)
        .maybeSingle(),
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
    memorize: Number(raw?.memorize_count ?? 0),
    recognize: Number(raw?.recognize_count ?? 0),
    produce: Number(raw?.produce_count ?? 0),
  };

  const dailyGoal = profileRes.data?.daily_goal ?? 10;
  const displayName = profileRes.data?.display_name ?? null;

  // Compute streak and today's done count.
  const daySet = new Set<string>();
  const dayCount: Record<string, number> = {};
  let doneToday = 0;
  for (const e of eventsRes.data ?? []) {
    const d = new Date(e.created_at);
    const day = isoDay(d);
    daySet.add(day);
    dayCount[day] = (dayCount[day] ?? 0) + 1;
    if (d >= todayStart) doneToday++;
  }
  let streak = 0;
  const cursor = new Date(now);
  cursor.setUTCHours(0, 0, 0, 0);
  while (daySet.has(isoDay(cursor))) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  // 14-day activity slices (oldest first).
  const activityDays: Array<{ iso: string; date: Date; count: number }> = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - i);
    const iso = isoDay(d);
    activityDays.push({ iso, date: d, count: dayCount[iso] ?? 0 });
  }

  const strugglingCount = strugglingRes.data?.length ?? 0;
  const masteredPct = stats.total > 0 ? Math.round((stats.mastered / stats.total) * 100) : 0;
  const goalProgress = dailyGoal > 0 ? Math.min(100, (doneToday / dailyGoal) * 100) : 0;

  const recentVocab = (recentVocabRes.data ?? []) as Array<{
    id: string;
    stage: VocabStage;
    created_at: string;
    custom_term: string | null;
    word: { lemma: string; meaning_ja: string | null } | null;
    idiom: { phrase: string; meaning_ja: string | null } | null;
  }>;

  const dateLabel = new Intl.DateTimeFormat(
    locale === 'ja' ? 'ja-JP' : 'en-US',
    { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' },
  ).format(now);

  return (
    <Stack gap="xl">
      {/* ── Greeting ── */}
      <Group justify="space-between" align="flex-end" wrap="wrap" gap="md">
        <Stack gap={4}>
          <Group gap={6}>
            <CalendarDays size={14} color="var(--mantine-color-dimmed)" />
            <Text c="dimmed" size="xs">
              {dateLabel}
            </Text>
          </Group>
          <Text fz={{ base: 28, md: 32 }} fw={700} lh={1.2}>
            {displayName
              ? t('greetingWithName', { name: displayName })
              : t('greeting')}
          </Text>
        </Stack>
        {streak > 0 ? (
          <Badge
            color="orange"
            variant="light"
            size="lg"
            leftSection={<Flame size={14} />}
          >
            {t('streakLabel', { count: streak })}
          </Badge>
        ) : null}
      </Group>

      {/* ── Today's primary action ── */}
      <Card
        withBorder
        radius="md"
        p={{ base: 'lg', md: 'xl' }}
        style={{
          background:
            stats.due > 0
              ? 'light-dark(color-mix(in srgb, var(--mantine-color-indigo-1) 40%, var(--mantine-color-white)), color-mix(in srgb, var(--mantine-color-indigo-9) 20%, var(--mantine-color-dark-7)))'
              : undefined,
        }}
      >
        <Group justify="space-between" wrap="wrap" gap="lg" align="center">
          <Stack gap="xs" style={{ minWidth: 0, flex: '1 1 280px' }}>
            <Group gap="xs">
              <ThemeIcon
                size={32}
                radius="md"
                color="indigo"
                variant={stats.due > 0 ? 'filled' : 'light'}
              >
                <Target size={16} />
              </ThemeIcon>
              <Text c="dimmed" size="xs" tt="uppercase" fw={600} lts={1}>
                {t('todaysWork')}
              </Text>
            </Group>
            <Text fz={{ base: 28, md: 36 }} fw={700} lh={1.15}>
              {stats.due > 0
                ? t('reviewHeadline', { count: stats.due })
                : t('allCaughtUpHeadline')}
            </Text>
            <Group gap="xs" wrap="wrap">
              <Text c="dimmed" size="sm">
                {t('goalProgress', { done: doneToday, goal: dailyGoal })}
              </Text>
            </Group>
            <Progress
              value={goalProgress}
              color={goalProgress >= 100 ? 'teal' : 'indigo'}
              size="sm"
              mt={4}
              maw={360}
            />
          </Stack>
          <Group gap="xs">
            {stats.due > 0 ? (
              <LinkButton href="/review" size="md">
                {t('startReview')}
              </LinkButton>
            ) : (
              <LinkButton href="/read" size="md" variant="light">
                {t('keepReading')}
              </LinkButton>
            )}
            {strugglingCount > 0 ? (
              <LinkButton
                href="/drill"
                size="md"
                variant="subtle"
                color="grape"
                leftSection={<Dumbbell size={14} />}
              >
                {t('drillCta', { count: strugglingCount })}
              </LinkButton>
            ) : null}
          </Group>
        </Group>
      </Card>

      {/* ── Key stats ── */}
      <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md">
        <StatTile
          icon={<Layers size={16} />}
          color="gray"
          label={t('stats.totalVocab')}
          value={stats.total}
        />
        <StatTile
          icon={<TrendingUp size={16} />}
          color="yellow"
          label={t('stats.mastered')}
          value={stats.mastered}
          sub={`${masteredPct}%`}
        />
        <StatTile
          icon={<Sparkles size={16} />}
          color="teal"
          label={t('stats.doneToday')}
          value={doneToday}
          sub={t('of', { n: dailyGoal })}
        />
        <StatTile
          icon={<Flame size={16} />}
          color="orange"
          label={t('stats.streak')}
          value={streak}
          sub={streak > 0 ? t('days') : undefined}
        />
      </SimpleGrid>

      {/* ── Distribution + Activity ── */}
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <Card withBorder radius="md" p="lg">
          <Stack gap="md">
            <Group justify="space-between">
              <Text fw={600}>{t('distribution.title')}</Text>
              <Text c="dimmed" size="xs">
                {t('distribution.totalSuffix', { count: stats.total })}
              </Text>
            </Group>
            {stats.total === 0 ? (
              <Text c="dimmed" size="sm">
                {t('distribution.empty')}
              </Text>
            ) : (
              <>
                <StageBar
                  memorize={stats.memorize}
                  recognize={stats.recognize}
                  produce={stats.produce}
                  mastered={stats.mastered}
                />
                <SimpleGrid cols={2} spacing="xs">
                  <LegendItem
                    color="gray"
                    stage="memorize"
                    count={stats.memorize}
                  />
                  <LegendItem
                    color="indigo"
                    stage="recognize"
                    count={stats.recognize}
                  />
                  <LegendItem
                    color="teal"
                    stage="produce"
                    count={stats.produce}
                  />
                  <LegendItem
                    color="yellow"
                    stage="mastered"
                    count={stats.mastered}
                  />
                </SimpleGrid>
              </>
            )}
          </Stack>
        </Card>

        <Card withBorder radius="md" p="lg">
          <Stack gap="md">
            <Group justify="space-between">
              <Text fw={600}>{t('activity.title')}</Text>
              <Text c="dimmed" size="xs">
                {t('activity.range')}
              </Text>
            </Group>
            <Heatmap days={activityDays} locale={locale} />
            <Group gap={4} justify="flex-end">
              <Text c="dimmed" size="xs">
                {t('activity.less')}
              </Text>
              <HeatmapLegend />
              <Text c="dimmed" size="xs">
                {t('activity.more')}
              </Text>
            </Group>
          </Stack>
        </Card>
      </SimpleGrid>

      {/* ── Recent vocab ── */}
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
                const name =
                  r.word?.lemma ?? r.idiom?.phrase ?? r.custom_term ?? '';
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

/* ────────── Components ────────── */

function StatTile({
  icon,
  color,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  color: 'gray' | 'indigo' | 'teal' | 'yellow' | 'orange';
  label: string;
  value: number;
  sub?: string;
}) {
  return (
    <Card withBorder radius="md" p="lg">
      <Stack gap="xs">
        <Group gap="xs" align="center">
          <ThemeIcon size={24} radius="sm" variant="light" color={color}>
            {icon}
          </ThemeIcon>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600} lts={0.5}>
            {label}
          </Text>
        </Group>
        <Group gap={6} align="baseline">
          <Text fz={{ base: 24, md: 30 }} fw={700} lh={1}>
            {value}
          </Text>
          {sub ? (
            <Text size="xs" c="dimmed">
              {sub}
            </Text>
          ) : null}
        </Group>
      </Stack>
    </Card>
  );
}

function StageBar({
  memorize,
  recognize,
  produce,
  mastered,
}: {
  memorize: number;
  recognize: number;
  produce: number;
  mastered: number;
}) {
  const total = memorize + recognize + produce + mastered;
  if (total === 0) return null;
  const segs = [
    { count: memorize, bg: 'var(--mantine-color-gray-4)', label: 'memorize' },
    { count: recognize, bg: 'var(--mantine-color-indigo-5)', label: 'recognize' },
    { count: produce, bg: 'var(--mantine-color-teal-5)', label: 'produce' },
    { count: mastered, bg: 'var(--mantine-color-yellow-5)', label: 'mastered' },
  ];
  return (
    <div
      style={{
        display: 'flex',
        height: 12,
        borderRadius: 6,
        overflow: 'hidden',
        gap: 2,
        background:
          'light-dark(var(--mantine-color-gray-1), var(--mantine-color-dark-5))',
      }}
    >
      {segs.map((s, i) =>
        s.count > 0 ? (
          <Tooltip key={i} label={`${s.label}: ${s.count}`} withArrow>
            <div
              style={{
                flex: `${s.count} 0 0`,
                background: s.bg,
                minWidth: 6,
              }}
            />
          </Tooltip>
        ) : null,
      )}
    </div>
  );
}

function LegendItem({
  color,
  stage,
  count,
}: {
  color: string;
  stage: VocabStage;
  count: number;
}) {
  return (
    <Group gap={6} wrap="nowrap">
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: 2,
          background: `var(--mantine-color-${color}-${color === 'gray' ? 4 : 5})`,
          flexShrink: 0,
        }}
      />
      <StageBadge stage={stage} size="xs" variant="transparent" />
      <Text size="xs" c="dimmed" ml="auto">
        {count}
      </Text>
    </Group>
  );
}

function Heatmap({
  days,
  locale,
}: {
  days: Array<{ iso: string; date: Date; count: number }>;
  locale: string;
}) {
  const max = Math.max(1, ...days.map((d) => d.count));
  const fmt = new Intl.DateTimeFormat(
    locale === 'ja' ? 'ja-JP' : 'en-US',
    { month: 'short', day: 'numeric' },
  );
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(14, 1fr)',
        gap: 4,
      }}
    >
      {days.map((d) => {
        const intensity = d.count === 0 ? 0 : 0.22 + (d.count / max) * 0.78;
        const bg =
          d.count === 0
            ? 'light-dark(var(--mantine-color-gray-2), var(--mantine-color-dark-5))'
            : `color-mix(in srgb, var(--mantine-color-indigo-6) ${intensity * 100}%, transparent)`;
        return (
          <Tooltip
            key={d.iso}
            label={`${fmt.format(d.date)} · ${d.count}`}
            withArrow
          >
            <div
              style={{
                aspectRatio: '1 / 1',
                borderRadius: 3,
                background: bg,
              }}
            />
          </Tooltip>
        );
      })}
    </div>
  );
}

function HeatmapLegend() {
  const steps = [0, 0.35, 0.55, 0.75, 1];
  return (
    <Group gap={3}>
      {steps.map((v, i) => (
        <div
          key={i}
          style={{
            width: 10,
            height: 10,
            borderRadius: 2,
            background:
              v === 0
                ? 'light-dark(var(--mantine-color-gray-2), var(--mantine-color-dark-5))'
                : `color-mix(in srgb, var(--mantine-color-indigo-6) ${v * 100}%, transparent)`,
          }}
        />
      ))}
    </Group>
  );
}
