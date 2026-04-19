'use client';

import { Stack } from '@mantine/core';
import { useMemo, useState } from 'react';

import { PassageAudioPlayer } from './PassageAudioPlayer';
import { PassageReader } from './PassageReader';
import type { IdiomSpan, PassageToken } from '@/lib/text/tokenize';
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
  const [currentWordIndex, setCurrentWordIndex] = useState<number | null>(null);

  // The server aligns timings to the ordered list of word surfaces in `body`.
  // We replicate that ordering on the client to map index → token id.
  const wordTokenIds = useMemo(() => {
    const ids: number[] = [];
    for (const tk of props.tokens) {
      if (tk.kind === 'word') ids.push(tk.id);
    }
    return ids;
  }, [props.tokens]);

  const currentWordTokenId =
    currentWordIndex != null ? (wordTokenIds[currentWordIndex] ?? null) : null;

  return (
    <Stack gap="lg">
      <PassageAudioPlayer
        text={props.body}
        onWordChange={setCurrentWordIndex}
      />
      <PassageReader {...props} currentWordTokenId={currentWordTokenId} />
    </Stack>
  );
}
