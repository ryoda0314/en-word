import { Badge, Container, Group, Stack, Text, Title } from '@mantine/core';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { PassageReader } from '@/components/reader/PassageReader';
import { tokenizePassage } from '@/lib/text/tokenize';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { IdiomRow, WordRow } from '@/types/db';

export default async function PassagePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('read');

  const supabase = await createSupabaseServerClient();

  const { data: passage } = await supabase
    .from('passages')
    .select('id, slug, title, body, level, part, word_count')
    .eq('slug', slug)
    .maybeSingle();

  if (!passage) notFound();

  const [{ data: words }, { data: idioms }] = await Promise.all([
    supabase.from('words').select('*'),
    supabase.from('idioms').select('*'),
  ]);

  const wordsByLemma = new Map<string, { id: string }>();
  const wordsById = new Map<string, WordRow>();
  for (const w of (words ?? []) as WordRow[]) {
    wordsByLemma.set(w.lemma.toLowerCase(), { id: w.id });
    wordsById.set(w.id, w);
  }

  const idiomsById = new Map<string, IdiomRow>();
  for (const i of (idioms ?? []) as IdiomRow[]) idiomsById.set(i.id, i);

  const { tokens, idiomSpans } = tokenizePassage({
    body: passage.body,
    wordsByLemma,
    idioms: (idioms ?? []).map((i) => ({ id: i.id, phrase: i.phrase })),
  });

  // Fetch existing user_vocab for the ids seen in this passage.
  const seenWordIds = new Set<string>();
  const seenIdiomIds = new Set<string>();
  for (const t of tokens) {
    if (t.kind === 'word' && t.wordId) seenWordIds.add(t.wordId);
  }
  for (const s of idiomSpans) seenIdiomIds.add(s.idiomId);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const savedWordIds = new Set<string>();
  const savedIdiomIds = new Set<string>();
  const savedCustomTerms: string[] = [];

  if (user) {
    const orClauses = [
      seenWordIds.size > 0
        ? `word_id.in.(${Array.from(seenWordIds).join(',')})`
        : null,
      seenIdiomIds.size > 0
        ? `idiom_id.in.(${Array.from(seenIdiomIds).join(',')})`
        : null,
      `source_passage_id.eq.${passage.id}`,
    ].filter(Boolean) as string[];

    const { data: savedRows } = await supabase
      .from('user_vocab')
      .select('word_id, idiom_id, custom_term')
      .eq('user_id', user.id)
      .or(orClauses.join(','));
    for (const row of savedRows ?? []) {
      if (row.word_id) savedWordIds.add(row.word_id);
      if (row.idiom_id) savedIdiomIds.add(row.idiom_id);
      if (row.custom_term) savedCustomTerms.push(row.custom_term);
    }
  }

  // Serialize lookup maps as plain objects for the client component.
  const wordsDict: Record<string, WordRow> = {};
  for (const [id, w] of wordsById) wordsDict[id] = w;
  const idiomsDict: Record<string, IdiomRow> = {};
  for (const [id, i] of idiomsById) idiomsDict[id] = i;

  return (
    <Container size="md" px={0}>
      <Stack gap="xl">
        <Stack gap={6}>
          <Group gap={6} wrap="wrap">
            {passage.part ? (
              <Badge color="indigo" variant="light" size="sm">
                {passage.part}
              </Badge>
            ) : null}
            {passage.level ? (
              <Badge variant="default" size="sm">
                {passage.level}
              </Badge>
            ) : null}
          </Group>
          <Title order={2} lh={1.25}>
            {passage.title}
          </Title>
          <Text c="dimmed" size="sm">
            {t('tapHint')}
          </Text>
        </Stack>

        <PassageReader
          passageId={passage.id}
          tokens={tokens}
          idiomSpans={idiomSpans}
          wordsDict={wordsDict}
          idiomsDict={idiomsDict}
          savedWordIds={Array.from(savedWordIds)}
          savedIdiomIds={Array.from(savedIdiomIds)}
          savedCustomTerms={savedCustomTerms}
          body={passage.body}
        />
      </Stack>
    </Container>
  );
}
