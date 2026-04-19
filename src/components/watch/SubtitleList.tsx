'use client';

import { useEffect, useRef } from 'react';

import { SubtitleCue } from './SubtitleCue';
import type { IdiomSpan, PassageToken } from '@/lib/text/tokenize';
import type { IdiomRow, WordRow } from '@/types/db';

import styles from './SubtitleList.module.css';

export type TokenizedCue = {
  id: string;
  seq: number;
  start_ms: number;
  end_ms: number;
  text: string;
  tokens: PassageToken[];
  idiomSpans: IdiomSpan[];
};

type Props = {
  videoId: string;
  cues: TokenizedCue[];
  currentMs: number;
  wordsDict: Record<string, WordRow>;
  idiomsDict: Record<string, IdiomRow>;
  savedWordIds: Set<string>;
  savedIdiomIds: Set<string>;
  savedCustomTerms: Set<string>;
  onSavedWord: (id: string) => void;
  onSavedIdiom: (id: string) => void;
  onSavedCustom: (term: string) => void;
  onSeek?: (ms: number) => void;
};

export function SubtitleList({
  videoId,
  cues,
  currentMs,
  wordsDict,
  idiomsDict,
  savedWordIds,
  savedIdiomIds,
  savedCustomTerms,
  onSavedWord,
  onSavedIdiom,
  onSavedCustom,
  onSeek,
}: Props) {
  const activeSeq = findActiveSeq(cues, currentMs);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastActiveRef = useRef<number | null>(null);

  useEffect(() => {
    if (activeSeq === null) return;
    if (activeSeq === lastActiveRef.current) return;
    lastActiveRef.current = activeSeq;
    const host = containerRef.current;
    if (!host) return;
    const el = host.querySelector<HTMLElement>(
      `[data-cue-seq="${activeSeq}"]`,
    );
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [activeSeq]);

  return (
    <div ref={containerRef} className={styles.list}>
      {cues.map((cue) => (
        <SubtitleCue
          key={cue.id}
          videoId={videoId}
          cueSeq={cue.seq}
          cueText={cue.text}
          tokens={cue.tokens}
          idiomSpans={cue.idiomSpans}
          wordsDict={wordsDict}
          idiomsDict={idiomsDict}
          active={cue.seq === activeSeq}
          savedWordIds={savedWordIds}
          savedIdiomIds={savedIdiomIds}
          savedCustomTerms={savedCustomTerms}
          onSavedWord={onSavedWord}
          onSavedIdiom={onSavedIdiom}
          onSavedCustom={onSavedCustom}
          onRequestSeek={onSeek}
          startMs={cue.start_ms}
        />
      ))}
    </div>
  );
}

function findActiveSeq(cues: TokenizedCue[], ms: number): number | null {
  // Linear scan is fine for typical cue counts (<2000). Could binary-search
  // if this becomes a bottleneck.
  for (const c of cues) {
    if (ms >= c.start_ms && ms < c.end_ms) return c.seq;
  }
  // Fall back to the most recent cue whose start is <= ms.
  let best: number | null = null;
  for (const c of cues) {
    if (c.start_ms <= ms) best = c.seq;
    else break;
  }
  return best;
}
