import {
  Badge,
  Card,
  Divider,
  Group,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { StageBadge } from '@/components/vocab/StageBadge';
import { VocabDetailActions } from '@/components/vocab/VocabDetailActions';
import { Link } from '@/i18n/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { VocabStage } from '@/types/db';

export default async function VocabDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('vocab');

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: row } = await supabase
    .from('user_vocab')
    .select(
      `id, stage, next_review_at, last_reviewed_at, created_at,
       custom_term, custom_meaning_ja, context_sentence,
       word:words(id, lemma, pos, ipa, meaning_ja, meaning_en, example_en, example_ja),
       idiom:idioms(id, phrase, meaning_ja, meaning_en, example_en, example_ja),
       passage:passages(id, slug, title)`,
    )
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!row) notFound();

  const word = row.word as
    | {
        id: string;
        lemma: string;
        pos: string | null;
        ipa: string | null;
        meaning_ja: string | null;
        meaning_en: string | null;
        example_en: string | null;
        example_ja: string | null;
      }
    | null;
  const idiom = row.idiom as
    | {
        id: string;
        phrase: string;
        meaning_ja: string | null;
        meaning_en: string | null;
        example_en: string | null;
        example_ja: string | null;
      }
    | null;
  const passage = row.passage as
    | { id: string; slug: string; title: string }
    | null;

  const displayName =
    word?.lemma ?? idiom?.phrase ?? row.custom_term ?? '';
  const displayMeaningJa =
    word?.meaning_ja ?? idiom?.meaning_ja ?? row.custom_meaning_ja ?? '';
  const displayMeaningEn = word?.meaning_en ?? idiom?.meaning_en ?? '';
  const exampleEn = word?.example_en ?? idiom?.example_en ?? '';
  const exampleJa = word?.example_ja ?? idiom?.example_ja ?? '';
  const ipa = word?.ipa ?? '';
  const pos = word?.pos ?? (idiom ? 'phrase' : 'custom');

  const kindLabel = idiom
    ? t('phrase')
    : row.custom_term
      ? t('custom')
      : t('word');

  const nextReview = new Date(row.next_review_at);
  const now = new Date();
  const diffMs = nextReview.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
  const reviewLabel =
    diffMs <= 0
      ? t('dueNow')
      : diffDays === 0
        ? t('dueLater')
        : t('dueInDays', { days: diffDays });

  return (
    <Stack gap="lg" maw={720}>
      <Group justify="space-between" align="flex-start">
        <Stack gap={6}>
          <Group gap={6} wrap="wrap">
            <Badge variant="light" color="indigo" size="sm">
              {kindLabel}
            </Badge>
            <Badge variant="default" size="sm">
              {pos}
            </Badge>
            {ipa ? (
              <Text c="dimmed" size="sm" ff="monospace">
                {ipa}
              </Text>
            ) : null}
          </Group>
          <Title order={1} size={32} lh={1.2}>
            {displayName}
          </Title>
        </Stack>
        <VocabDetailActions id={row.id} locale={locale} displayName={displayName} />
      </Group>

      <Card withBorder radius="md" p="lg">
        <Stack gap="md">
          <Group justify="space-between" align="flex-start">
            <Stack gap={4}>
              <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
                {t('detail.stage')}
              </Text>
              <StageBadge stage={row.stage as VocabStage} />
            </Stack>
            <Stack gap={4} align="flex-end">
              <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
                {t('detail.nextReview')}
              </Text>
              <Text size="sm">{reviewLabel}</Text>
            </Stack>
          </Group>

          {displayMeaningJa || displayMeaningEn ? (
            <>
              <Divider />
              <Stack gap={4}>
                <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
                  {t('detail.meaning')}
                </Text>
                {displayMeaningJa ? (
                  <Text size="md">{displayMeaningJa}</Text>
                ) : null}
                {displayMeaningEn ? (
                  <Text size="sm" c="dimmed">
                    {displayMeaningEn}
                  </Text>
                ) : null}
              </Stack>
            </>
          ) : null}

          {exampleEn ? (
            <>
              <Divider />
              <Stack gap={4}>
                <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
                  {t('detail.example')}
                </Text>
                <Text size="sm" fs="italic">
                  {exampleEn}
                </Text>
                {exampleJa ? (
                  <Text size="sm" c="dimmed">
                    {exampleJa}
                  </Text>
                ) : null}
              </Stack>
            </>
          ) : null}

          {row.context_sentence ? (
            <>
              <Divider />
              <Stack gap={4}>
                <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
                  {t('detail.contextSentence')}
                </Text>
                <Text size="sm" fs="italic">
                  “{row.context_sentence}”
                </Text>
                {passage ? (
                  <Text size="xs" c="dimmed">
                    {t('detail.fromPassage')}:{' '}
                    <Link
                      href={`/read/${passage.slug}`}
                      style={{ textDecoration: 'underline' }}
                    >
                      {passage.title}
                    </Link>
                  </Text>
                ) : null}
              </Stack>
            </>
          ) : null}
        </Stack>
      </Card>
    </Stack>
  );
}
