import { Badge, Container, Group, Stack, Text, Title } from '@mantine/core';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { WatchView } from '@/components/watch/WatchView';
import { getVideoWithCues } from '@/lib/actions/youtube';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { tokenizePassage } from '@/lib/text/tokenize';
import type { IdiomRow, WordRow } from '@/types/db';

export default async function WatchDetailPage({
  params,
}: {
  params: Promise<{ locale: string; youtubeId: string }>;
}) {
  const { locale, youtubeId } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('watch');

  const result = await getVideoWithCues(youtubeId);
  if (!result.ok) notFound();
  const { video, cues } = result;

  const supabase = await createSupabaseServerClient();
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

  const idiomList = (idioms ?? []).map((i) => ({ id: i.id, phrase: i.phrase }));

  const tokenizedCues = cues.map((cue) => {
    const { tokens, idiomSpans } = tokenizePassage({
      body: cue.text,
      wordsByLemma,
      idioms: idiomList,
    });
    return {
      id: cue.id,
      seq: cue.seq,
      start_ms: cue.start_ms,
      end_ms: cue.end_ms,
      text: cue.text,
      tokens,
      idiomSpans,
    };
  });

  // Which words / idioms are already saved, for the words that appear in this video
  const seenWordIds = new Set<string>();
  const seenIdiomIds = new Set<string>();
  for (const c of tokenizedCues) {
    for (const tk of c.tokens) {
      if (tk.kind === 'word' && tk.wordId) seenWordIds.add(tk.wordId);
    }
    for (const s of c.idiomSpans) seenIdiomIds.add(s.idiomId);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const savedWordIds: string[] = [];
  const savedIdiomIds: string[] = [];
  const savedCustomTerms: string[] = [];

  if (user) {
    const orClauses = [
      seenWordIds.size > 0
        ? `word_id.in.(${Array.from(seenWordIds).join(',')})`
        : null,
      seenIdiomIds.size > 0
        ? `idiom_id.in.(${Array.from(seenIdiomIds).join(',')})`
        : null,
      // user_vocab rows created from this video
      // (uses the new source_video_id column added in 20260419000003).
      `source_video_id.eq.${video.id}`,
    ].filter(Boolean) as string[];

    const { data: savedRows } = await supabase
      .from('user_vocab')
      .select('word_id, idiom_id, custom_term')
      .eq('user_id', user.id)
      .or(orClauses.join(','));
    for (const row of savedRows ?? []) {
      if (row.word_id) savedWordIds.push(row.word_id);
      if (row.idiom_id) savedIdiomIds.push(row.idiom_id);
      if (row.custom_term) savedCustomTerms.push(row.custom_term);
    }
  }

  const wordsDict: Record<string, WordRow> = {};
  for (const [id, w] of wordsById) wordsDict[id] = w;
  const idiomsDict: Record<string, IdiomRow> = {};
  for (const [id, i] of idiomsById) idiomsDict[id] = i;

  return (
    <Container size="xl" px={0}>
      <Stack gap="md">
        <Stack gap={4}>
          <Group gap={6} wrap="wrap">
            {video.lang ? (
              <Badge variant="default" size="sm">
                {video.lang}
              </Badge>
            ) : null}
            <Badge variant="light" color="indigo" size="sm">
              {t('cueCount', { count: cues.length })}
            </Badge>
          </Group>
          <Title order={3} lh={1.25}>
            {video.title ?? video.youtube_id}
          </Title>
          <Text c="dimmed" size="sm">
            {t('tapHint')}
          </Text>
        </Stack>

        <WatchView
          videoId={video.id}
          youtubeId={video.youtube_id}
          cues={tokenizedCues}
          wordsDict={wordsDict}
          idiomsDict={idiomsDict}
          savedWordIds={savedWordIds}
          savedIdiomIds={savedIdiomIds}
          savedCustomTerms={savedCustomTerms}
        />
      </Stack>
    </Container>
  );
}
