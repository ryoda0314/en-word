'use client';

import {
  Alert,
  Badge,
  Button,
  Divider,
  Group,
  Loader,
  Modal,
  Portal,
  Skeleton,
  Stack,
  Text,
} from '@mantine/core';
import {
  AlertCircle,
  BookmarkCheck,
  BookPlus,
  Quote,
  Sparkles,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';

import { SubtitleCue } from './SubtitleCue';
import { type GlossData, lookupGloss } from '@/lib/actions/gloss';
import { addToVocab } from '@/lib/actions/vocab';
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

type AiState =
  | { status: 'loading' }
  | { status: 'ready'; data: GlossData }
  | { status: 'error'; code: string };

type PhraseSel = {
  text: string;
  cueSeq: number;
  cueText: string;
  tokenIds: Set<number>;
  buttonTop: number;
  buttonLeft: number;
  groupRects: Array<{ top: number; left: number; width: number; height: number }>;
};

type PhraseModal = {
  text: string;
  cueSeq: number;
  cueText: string;
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
  const t = useTranslations('reader');
  const activeSeq = findActiveSeq(cues, currentMs);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastActiveRef = useRef<number | null>(null);

  const [phraseSel, setPhraseSel] = useState<PhraseSel | null>(null);
  const [phraseModal, setPhraseModal] = useState<PhraseModal | null>(null);
  const [phraseAi, setPhraseAi] = useState<AiState | null>(null);
  const [pending, startTransition] = useTransition();

  // Auto-scroll to active cue
  useEffect(() => {
    if (activeSeq === null) return;
    if (activeSeq === lastActiveRef.current) return;
    lastActiveRef.current = activeSeq;
    const host = containerRef.current;
    if (!host) return;
    const el = host.querySelector<HTMLElement>(`[data-cue-seq="${activeSeq}"]`);
    if (el) el.scrollIntoView({ block: 'center', behavior: 'instant' });
  }, [activeSeq]);

  // Single selectionchange listener for phrase selection across all cues
  useEffect(() => {
    function onSelectionChange() {
      const sel = window.getSelection();
      const container = containerRef.current;
      if (!sel || sel.isCollapsed || sel.rangeCount === 0 || !container) {
        setPhraseSel(null);
        return;
      }
      const range = sel.getRangeAt(0);
      if (!container.contains(range.commonAncestorContainer)) {
        setPhraseSel(null);
        return;
      }

      // Collect token spans and group by cue
      const allSpans = Array.from(container.querySelectorAll<HTMLElement>('[data-token-id]'));
      const bySeq = new Map<number, number[]>();
      for (const span of allSpans) {
        if (!range.intersectsNode(span)) continue;
        const tokenId = Number(span.dataset.tokenId);
        if (Number.isNaN(tokenId)) continue;
        const cueEl = span.closest<HTMLElement>('[data-cue-seq]');
        if (!cueEl) continue;
        const cueSeq = Number(cueEl.dataset.cueSeq);
        if (Number.isNaN(cueSeq)) continue;
        if (!bySeq.has(cueSeq)) bySeq.set(cueSeq, []);
        bySeq.get(cueSeq)!.push(tokenId);
      }

      // Require selection within a single cue
      if (bySeq.size !== 1) { setPhraseSel(null); return; }
      const [[cueSeq, tokenIds]] = [...bySeq.entries()];
      tokenIds.sort((a, b) => a - b);
      if (tokenIds.length < 2) { setPhraseSel(null); return; }

      const cue = cues.find((c) => c.seq === cueSeq);
      if (!cue) { setPhraseSel(null); return; }

      const wordTokens = new Map(
        cue.tokens.flatMap((t) =>
          t.kind === 'word' ? [[t.id, t] as [number, Extract<typeof t, { kind: 'word' }>]] : [],
        ),
      );
      const firstTok = wordTokens.get(tokenIds[0]);
      const lastTok = wordTokens.get(tokenIds[tokenIds.length - 1]);
      if (!firstTok || !lastTok) { setPhraseSel(null); return; }

      const text = cue.text.slice(firstTok.charStart, lastTok.charEnd).replace(/\s+/g, ' ').trim();

      const firstEl = container.querySelector<HTMLElement>(
        `[data-cue-seq="${cueSeq}"] [data-token-id="${firstTok.id}"]`,
      );
      const lastEl = container.querySelector<HTMLElement>(
        `[data-cue-seq="${cueSeq}"] [data-token-id="${lastTok.id}"]`,
      );
      if (!firstEl || !lastEl) { setPhraseSel(null); return; }

      const domRange = document.createRange();
      domRange.setStartBefore(firstEl);
      domRange.setEndAfter(lastEl);
      const rawRects = Array.from(domRange.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
      const LINE_EPSILON = 3;
      const sorted = rawRects.slice().sort((a, b) => a.top - b.top || a.left - b.left);
      const lineGroups: DOMRect[][] = [];
      for (const r of sorted) {
        const last = lineGroups[lineGroups.length - 1];
        if (
          last &&
          Math.abs(last[0].top - r.top) <= LINE_EPSILON &&
          Math.abs(last[0].bottom - r.bottom) <= LINE_EPSILON
        ) {
          last.push(r);
        } else {
          lineGroups.push([r]);
        }
      }
      const sy = window.scrollY;
      const sx = window.scrollX;
      const groupRects = lineGroups.map((line) => ({
        top: Math.min(...line.map((r) => r.top)) + sy,
        left: Math.min(...line.map((r) => r.left)) + sx,
        width: Math.max(...line.map((r) => r.right)) - Math.min(...line.map((r) => r.left)),
        height: Math.max(...line.map((r) => r.bottom)) - Math.min(...line.map((r) => r.top)),
      }));
      const r1 = firstEl.getBoundingClientRect();
      setPhraseSel({
        text,
        cueSeq,
        cueText: cue.text,
        tokenIds: new Set(tokenIds),
        buttonTop: r1.top + sy,
        buttonLeft: (r1.left + r1.right) / 2 + sx,
        groupRects,
      });
    }

    document.addEventListener('selectionchange', onSelectionChange);
    return () => document.removeEventListener('selectionchange', onSelectionChange);
  }, [cues]);

  const openPhraseModal = useCallback(() => {
    if (!phraseSel) return;
    setPhraseModal({ text: phraseSel.text, cueSeq: phraseSel.cueSeq, cueText: phraseSel.cueText });
    setPhraseAi({ status: 'loading' });
    setPhraseSel(null);
    window.getSelection()?.removeAllRanges();
    lookupGloss({ term: phraseSel.text, kind: 'phrase', context: phraseSel.cueText }).then((res) => {
      setPhraseAi(res.ok ? { status: 'ready', data: res.gloss } : { status: 'error', code: res.error });
    });
  }, [phraseSel]);

  function savePhrase(gloss: GlossData) {
    if (!phraseModal) return;
    const { cueSeq, cueText } = phraseModal;
    startTransition(async () => {
      const result = gloss.idiomId
        ? await addToVocab({ idiomId: gloss.idiomId, sourceVideoId: videoId, sourceVideoCueSeq: cueSeq, contextSentence: cueText })
        : await addToVocab({ customTerm: gloss.headword, customMeaningJa: gloss.meaning_ja, sourceVideoId: videoId, sourceVideoCueSeq: cueSeq, contextSentence: cueText });
      if (result.ok) {
        if (gloss.idiomId) onSavedIdiom(gloss.idiomId);
        else onSavedCustom(gloss.headword);
        setPhraseModal(null);
        setPhraseAi(null);
      }
    });
  }

  return (
    <>
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
            phraseSelTokenIds={phraseSel?.cueSeq === cue.seq ? phraseSel.tokenIds : undefined}
          />
        ))}
      </div>

      {phraseSel ? (
        <Portal>
          {phraseSel.groupRects.map((r, i) => (
            <div
              key={i}
              className={styles.phraseOutline}
              style={{ top: r.top - 2, left: r.left - 2, width: r.width + 4, height: r.height + 4 }}
              aria-hidden
            />
          ))}
          <div
            className={styles.phraseFab}
            style={{ top: phraseSel.buttonTop, left: phraseSel.buttonLeft }}
          >
            <Button
              size="xs"
              leftSection={<Quote size={14} />}
              variant="filled"
              onMouseDown={(e) => { e.preventDefault(); openPhraseModal(); }}
            >
              {t('lookupPhrase')} ({phraseSel.tokenIds.size})
            </Button>
          </div>
        </Portal>
      ) : null}

      <Modal
        opened={phraseModal !== null}
        onClose={() => { setPhraseModal(null); setPhraseAi(null); }}
        title={phraseModal ? (
          <Group gap="xs">
            <Sparkles size={16} />
            <Text fw={600}>{phraseModal.text}</Text>
          </Group>
        ) : null}
        size="md"
      >
        {phraseModal && phraseAi ? (
          <PhraseResultBody
            state={phraseAi}
            saved={savedCustomTerms.has(phraseModal.text.toLowerCase())}
            pending={pending}
            onSave={savePhrase}
            onRetry={() => {
              setPhraseAi({ status: 'loading' });
              lookupGloss({ term: phraseModal.text, kind: 'phrase', context: phraseModal.cueText }).then((res) => {
                setPhraseAi(res.ok ? { status: 'ready', data: res.gloss } : { status: 'error', code: res.error });
              });
            }}
          />
        ) : null}
      </Modal>
    </>
  );
}

function PhraseResultBody({
  state,
  saved,
  pending,
  onSave,
  onRetry,
}: {
  state: AiState;
  saved: boolean;
  pending: boolean;
  onSave: (gloss: GlossData) => void;
  onRetry: () => void;
}) {
  const t = useTranslations('reader');
  if (state.status === 'loading') {
    return (
      <Stack gap="xs">
        <Group gap="xs">
          <Loader size="xs" />
          <Text size="xs" c="dimmed">{t('lookingUp')}</Text>
        </Group>
        <Skeleton height={14} radius="sm" />
        <Skeleton height={14} radius="sm" width="70%" />
      </Stack>
    );
  }
  if (state.status === 'error') {
    const msg =
      state.code === 'RATE_LIMITED' ? t('rateLimited') :
      state.code === 'UNAUTHENTICATED' ? t('notSignedIn') :
      t('aiFailed');
    return (
      <Stack gap="xs">
        <Alert color="red" variant="light" icon={<AlertCircle size={14} />} p="xs">
          <Text size="xs">{msg}</Text>
        </Alert>
        <Button size="xs" variant="light" onClick={onRetry}>{t('retry')}</Button>
      </Stack>
    );
  }
  const gloss = state.data;
  return (
    <Stack gap="xs">
      <Group gap={6} wrap="wrap" align="center">
        <Text fw={700} fz="lg">{gloss.headword}</Text>
        {gloss.pos ? <Badge size="xs" variant="default">{gloss.pos}</Badge> : null}
        {gloss.ipa ? <Text c="dimmed" size="xs" ff="monospace">{gloss.ipa}</Text> : null}
        <Badge size="xs" color="grape" variant="light">
          <Group gap={4} wrap="nowrap"><Sparkles size={10} />{t('aiBadge')}</Group>
        </Badge>
      </Group>
      {gloss.meaning_ja ? <Text size="sm">{gloss.meaning_ja}</Text> : null}
      {gloss.meaning_en ? <Text c="dimmed" size="xs" lh={1.5}>{gloss.meaning_en}</Text> : null}
      {gloss.example_en ? (
        <>
          <Divider my={4} />
          <Text size="xs" fs="italic">{gloss.example_en}</Text>
          {gloss.example_ja ? <Text c="dimmed" size="xs">{gloss.example_ja}</Text> : null}
        </>
      ) : null}
      <Group mt={6} justify="flex-end">
        {saved ? (
          <Badge color="teal" variant="light" leftSection={<BookmarkCheck size={12} />}>
            {t('saved')}
          </Badge>
        ) : (
          <Button size="xs" leftSection={<BookPlus size={14} />} loading={pending} onClick={() => onSave(gloss)}>
            {t('addToVocab')}
          </Button>
        )}
      </Group>
    </Stack>
  );
}

function findActiveSeq(cues: TokenizedCue[], ms: number): number | null {
  for (const c of cues) {
    if (ms >= c.start_ms && ms < c.end_ms) return c.seq;
  }
  let best: number | null = null;
  for (const c of cues) {
    if (c.start_ms <= ms) best = c.seq;
    else break;
  }
  return best;
}
