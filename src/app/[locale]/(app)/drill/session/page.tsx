import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { ReviewSession, type ReviewCard } from '@/components/review/ReviewSession';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function DrillSessionPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: cards } = await supabase
    .from('user_vocab')
    .select(
      `id, stage, custom_term, custom_meaning_ja, context_sentence,
       word:words(lemma, meaning_ja, meaning_en, example_en, example_ja, pos, ipa),
       idiom:idioms(phrase, meaning_ja, meaning_en, example_en, example_ja)`,
    )
    .eq('user_id', user.id)
    .neq('stage', 'mastered')
    .gt('lapses', 0)
    .order('last_reviewed_at', { ascending: true })
    .limit(15);

  return (
    <ReviewSession
      cards={(cards ?? []) as unknown as ReviewCard[]}
      locale={locale}
      onExitHref={`/${locale}/drill`}
    />
  );
}
