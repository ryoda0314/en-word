import { Stack, Text, Title } from '@mantine/core';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { TickerClient, type TickerCard } from '@/components/ticker/TickerClient';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function TickerPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('ticker');

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: cards } = await supabase
    .from('user_vocab')
    .select(
      `id, stage, custom_term, custom_meaning_ja, context_sentence,
       next_review_at, created_at, lapses,
       word:words(lemma, meaning_ja, meaning_en, example_en, example_ja, pos, ipa),
       idiom:idioms(phrase, meaning_ja, meaning_en, example_en, example_ja)`,
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(300);

  return (
    <Stack gap="lg">
      <Stack gap={4}>
        <Title order={2}>{t('title')}</Title>
        <Text c="dimmed" size="sm">
          {t('subtitle')}
        </Text>
      </Stack>
      <TickerClient cards={(cards ?? []) as unknown as TickerCard[]} />
    </Stack>
  );
}
