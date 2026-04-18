import { Stack, Text, Title } from '@mantine/core';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { VocabFilters } from '@/components/vocab/VocabFilters';
import { VocabListRow, type VocabListItem } from '@/components/vocab/VocabListRow';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { VocabStage } from '@/types/db';

const STAGE_VALUES: VocabStage[] = ['memorize', 'recognize', 'produce', 'mastered'];

export default async function VocabPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ stage?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { stage: stageParam } = await searchParams;
  const t = await getTranslations('vocab');

  const stage: VocabStage | 'all' = STAGE_VALUES.includes(stageParam as VocabStage)
    ? (stageParam as VocabStage)
    : 'all';

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  let query = supabase
    .from('user_vocab')
    .select(
      `id, stage, next_review_at, custom_term, custom_meaning_ja, context_sentence,
       word:words(lemma, meaning_ja, pos),
       idiom:idioms(phrase, meaning_ja)`,
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(200);

  if (stage !== 'all') query = query.eq('stage', stage);

  const [{ data: rows }, statsRes] = await Promise.all([
    query,
    supabase.rpc('vocab_stats'),
  ]);

  const statsRaw = Array.isArray(statsRes.data) ? statsRes.data[0] : statsRes.data;
  const stats = {
    total_count: Number(statsRaw?.total_count ?? 0),
    memorize_count: Number(statsRaw?.memorize_count ?? 0),
    recognize_count: Number(statsRaw?.recognize_count ?? 0),
    produce_count: Number(statsRaw?.produce_count ?? 0),
    mastered_count: Number(statsRaw?.mastered_count ?? 0),
  };

  return (
    <Stack gap="lg">
      <Stack gap={4}>
        <Title order={2}>{t('title')}</Title>
        <Text c="dimmed" size="sm">
          {t('subtitle')}
        </Text>
      </Stack>

      <VocabFilters currentStage={stage} stats={stats} />

      {(rows ?? []).length === 0 ? (
        <Text c="dimmed">{t('empty')}</Text>
      ) : (
        <Stack gap="sm">
          {(rows ?? []).map((r) => (
            <VocabListRow
              key={r.id}
              item={r as VocabListItem}
              dueLabel={t('due')}
              customLabel={t('custom')}
              phraseLabel={t('phrase')}
            />
          ))}
        </Stack>
      )}
    </Stack>
  );
}
