'use client';

import { useMemo, useState } from 'react';
import { Stack } from '@mantine/core';

import { PassageAudioPlayer } from './PassageAudioPlayer';
import { PassageReader } from './PassageReader';
import type { IdiomSpan, PassageToken } from '@/lib/text/tokenize';
import { splitSentences } from '@/lib/text/sentences';
import type { IdiomRow, WordRow } from '@/types/db';

type Props = {
  passageId: string;
  body: string;
  tokens: PassageToken[];
  idiomSpans: IdiomSpan[];
  wordsDict: Record<string, WordRow>;
  idiomsDict: Record<string, IdiomRow>;
  savedWordIds: string[];
  savedIdiomIds: string[];
  savedCustomTerms: string[];
};

export function PassageWithAudio(props: Props) {
  const sentences = useMemo(() => splitSentences(props.body), [props.body]);
  const [highlightRange, setHighlightRange] = useState<
    { start: number; end: number } | null
  >(null);

  return (
    <Stack gap="lg">
      <PassageAudioPlayer
        text={props.body}
        sentences={sentences}
        onRangeChange={setHighlightRange}
      />
      <PassageReader {...props} highlightRange={highlightRange} />
    </Stack>
  );
}
