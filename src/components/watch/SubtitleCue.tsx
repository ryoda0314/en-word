'use client';

import {
  Alert,
  Badge,
  Button,
  Divider,
  Group,
  Loader,
  Popover,
  Skeleton,
  Stack,
  Text,
} from '@mantine/core';
import {
  AlertCircle,
  BookmarkCheck,
  BookPlus,
  Sparkles,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState, useTransition } from 'react';

import { type GlossData, lookupGloss } from '@/lib/actions/gloss';
import { addToVocab } from '@/lib/actions/vocab';
import type { IdiomSpan, PassageToken } from '@/lib/text/tokenize';
import type { IdiomRow, WordRow } from '@/types/db';

import styles from './SubtitleCue.module.css';

type AiState =
  | { status: 'loading' }
  | { status: 'ready'; data: GlossData }
  | { status: 'error'; code: string };

type Props = {
  videoId: string;
  cueSeq: number;
  cueText: string;
  tokens: PassageToken[];
  idiomSpans: IdiomSpan[];
  wordsDict: Record<string, WordRow>;
  idiomsDict: Record<string, IdiomRow>;
  active: boolean;
  savedWordIds: Set<string>;
  savedIdiomIds: Set<string>;
  savedCustomTerms: Set<string>;
  onSavedWord: (id: string) => void;
  onSavedIdiom: (id: string) => void;
  onSavedCustom: (term: string) => void;
  onRequestSeek?: (ms: number) => void;
  startMs: number;
  phraseSelTokenIds?: Set<number>;
};

export function SubtitleCue({
  videoId,
  cueSeq,
  cueText,
  tokens,
  idiomSpans,
  wordsDict,
  idiomsDict,
  active,
  savedWordIds,
  savedIdiomIds,
  savedCustomTerms,
  onSavedWord,
  onSavedIdiom,
  onSavedCustom,
  onRequestSeek,
  startMs,
  phraseSelTokenIds,
}: Props) {
  const [openTokenId, setOpenTokenId] = useState<number | null>(null);
  const [aiByTokenId, setAiByTokenId] = useState<Record<number, AiState>>({});
  const [pending, startTransition] = useTransition();

  const idiomSpanById = new Map(idiomSpans.map((s) => [s.id, s]));

  useEffect(() => {
    if (openTokenId === null) return;
    const token = tokens.find(
      (t) => t.kind === 'word' && t.id === openTokenId,
    ) as Extract<PassageToken, { kind: 'word' }> | undefined;
    if (!token) return;
    if (token.wordId || token.idiomSpanIds.length > 0) return;
    if (aiByTokenId[openTokenId]) return;
    setAiByTokenId((prev) => ({ ...prev, [openTokenId]: { status: 'loading' } }));
    lookupGloss({ term: token.surface, kind: 'word', context: cueText }).then(
      (res) => {
        setAiByTokenId((prev) => ({
          ...prev,
          [openTokenId]: res.ok
            ? { status: 'ready', data: res.gloss }
            : { status: 'error', code: res.error },
        }));
      },
    );
  }, [openTokenId, tokens, cueText, aiByTokenId]);

  function saveWord(word: WordRow) {
    startTransition(async () => {
      const result = await addToVocab({
        wordId: word.id,
        sourceVideoId: videoId,
        sourceVideoCueSeq: cueSeq,
        contextSentence: cueText,
      });
      if (result.ok) {
        onSavedWord(word.id);
        setOpenTokenId(null);
      }
    });
  }

  function saveIdiom(idiom: IdiomRow) {
    startTransition(async () => {
      const result = await addToVocab({
        idiomId: idiom.id,
        sourceVideoId: videoId,
        sourceVideoCueSeq: cueSeq,
        contextSentence: cueText,
      });
      if (result.ok) {
        onSavedIdiom(idiom.id);
        setOpenTokenId(null);
      }
    });
  }

  function saveAi(gloss: GlossData) {
    startTransition(async () => {
      const result = gloss.wordId
        ? await addToVocab({
            wordId: gloss.wordId,
            sourceVideoId: videoId,
            sourceVideoCueSeq: cueSeq,
            contextSentence: cueText,
          })
        : await addToVocab({
            customTerm: gloss.headword,
            customMeaningJa: gloss.meaning_ja,
            sourceVideoId: videoId,
            sourceVideoCueSeq: cueSeq,
            contextSentence: cueText,
          });
      if (result.ok) {
        if (gloss.wordId) onSavedWord(gloss.wordId);
        else onSavedCustom(gloss.headword.toLowerCase());
        setOpenTokenId(null);
      }
    });
  }

  function retryAi(token: Extract<PassageToken, { kind: 'word' }>) {
    setAiByTokenId((prev) => ({ ...prev, [token.id]: { status: 'loading' } }));
    lookupGloss({ term: token.surface, kind: 'word', context: cueText }).then(
      (res) =>
        setAiByTokenId((prev) => ({
          ...prev,
          [token.id]: res.ok
            ? { status: 'ready', data: res.gloss }
            : { status: 'error', code: res.error },
        })),
    );
  }

  return (
    <div
      className={[styles.cue, active ? styles.active : null]
        .filter(Boolean)
        .join(' ')}
      data-cue-seq={cueSeq}
    >
      <button
        type="button"
        className={styles.timeLabel}
        onClick={() => onRequestSeek?.(startMs)}
        aria-label="jump"
      >
        {formatTime(startMs)}
      </button>
      <div className={styles.cueText}>
        {tokens.map((token, i) => {
          if (token.kind === 'text') {
            return (
              <span key={`t-${i}`}>{token.text.replace(/\n/g, ' ')}</span>
            );
          }

          const firstIdiomSpanId = token.idiomSpanIds[0];
          const idiomSpan =
            firstIdiomSpanId !== undefined
              ? idiomSpanById.get(firstIdiomSpanId)
              : undefined;
          const idiom = idiomSpan
            ? (idiomsDict[idiomSpan.idiomId] ?? null)
            : null;
          const word = token.wordId ? (wordsDict[token.wordId] ?? null) : null;

          const isDict = !!word || !!idiom;
          const isSaved = Boolean(
            (idiom && savedIdiomIds.has(idiom.id)) ||
              (word && savedWordIds.has(word.id)) ||
              savedCustomTerms.has(token.surface.toLowerCase()),
          );
          const isInSelection = phraseSelTokenIds?.has(token.id) ?? false;

          const className = [
            styles.token,
            isDict ? null : styles.unknown,
            word ? styles.inDict : null,
            idiom ? styles.inIdiom : null,
            isSaved ? styles.saved : null,
            isInSelection ? styles.inSelection : null,
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <Popover
              key={`w-${token.id}`}
              opened={openTokenId === token.id}
              onChange={(open) => setOpenTokenId(open ? token.id : null)}
              position="bottom"
              shadow="md"
              width={320}
              withinPortal
              closeOnClickOutside
              closeOnEscape
            >
              <Popover.Target>
                <span
                  role="button"
                  tabIndex={0}
                  data-token-id={token.id}
                  className={className}
                  onClick={(e) => {
                    e.stopPropagation();
                    // Don't open popover when user is making a phrase selection
                    if ((window.getSelection()?.toString().trim().split(/\s+/).filter(Boolean).length ?? 0) >= 2) return;
                    setOpenTokenId((curr) =>
                      curr === token.id ? null : token.id,
                    );
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setOpenTokenId((curr) =>
                        curr === token.id ? null : token.id,
                      );
                    }
                  }}
                >
                  {token.surface}
                </span>
              </Popover.Target>
              <Popover.Dropdown p="md">
                {idiom ? (
                  <IdiomCard
                    idiom={idiom}
                    saved={savedIdiomIds.has(idiom.id)}
                    pending={pending}
                    onSave={() => saveIdiom(idiom)}
                  />
                ) : word ? (
                  <WordCard
                    word={word}
                    saved={savedWordIds.has(word.id)}
                    pending={pending}
                    onSave={() => saveWord(word)}
                  />
                ) : (
                  <AiWordCard
                    state={aiByTokenId[token.id]}
                    saved={savedCustomTerms.has(token.surface.toLowerCase())}
                    pending={pending}
                    onSave={saveAi}
                    onRetry={() => retryAi(token)}
                  />
                )}
              </Popover.Dropdown>
            </Popover>
          );
        })}
      </div>
    </div>
  );
}

function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

function WordCard({
  word,
  saved,
  pending,
  onSave,
}: {
  word: WordRow;
  saved: boolean;
  pending: boolean;
  onSave: () => void;
}) {
  const t = useTranslations('reader');
  return (
    <Stack gap="xs">
      <Group gap={6} wrap="wrap" align="center">
        <Text fw={700} fz="lg">{word.lemma}</Text>
        {word.pos ? <Badge size="xs" variant="default">{word.pos}</Badge> : null}
        {word.ipa ? <Text c="dimmed" size="xs" ff="monospace">{word.ipa}</Text> : null}
      </Group>
      {word.meaning_ja ? <Text size="sm">{word.meaning_ja}</Text> : null}
      {word.meaning_en ? <Text c="dimmed" size="xs" lh={1.5}>{word.meaning_en}</Text> : null}
      {word.example_en ? (
        <>
          <Divider my={4} />
          <Text size="xs" fs="italic">{word.example_en}</Text>
          {word.example_ja ? <Text c="dimmed" size="xs">{word.example_ja}</Text> : null}
        </>
      ) : null}
      <Group mt={6} justify="flex-end">
        {saved ? (
          <Badge color="teal" variant="light" leftSection={<BookmarkCheck size={12} />}>
            {t('saved')}
          </Badge>
        ) : (
          <Button size="xs" leftSection={<BookPlus size={14} />} loading={pending} onClick={onSave}>
            {t('addToVocab')}
          </Button>
        )}
      </Group>
    </Stack>
  );
}

function IdiomCard({
  idiom,
  saved,
  pending,
  onSave,
}: {
  idiom: IdiomRow;
  saved: boolean;
  pending: boolean;
  onSave: () => void;
}) {
  const t = useTranslations('reader');
  return (
    <Stack gap="xs">
      <Group gap={6} wrap="wrap" align="center">
        <Badge size="xs" color="indigo" variant="light">{t('idiomBadge')}</Badge>
        <Text fw={700} fz="md">{idiom.phrase}</Text>
      </Group>
      {idiom.meaning_ja ? <Text size="sm">{idiom.meaning_ja}</Text> : null}
      {idiom.meaning_en ? <Text c="dimmed" size="xs" lh={1.5}>{idiom.meaning_en}</Text> : null}
      {idiom.example_en ? (
        <>
          <Divider my={4} />
          <Text size="xs" fs="italic">{idiom.example_en}</Text>
          {idiom.example_ja ? <Text c="dimmed" size="xs">{idiom.example_ja}</Text> : null}
        </>
      ) : null}
      <Group mt={6} justify="flex-end">
        {saved ? (
          <Badge color="teal" variant="light" leftSection={<BookmarkCheck size={12} />}>
            {t('saved')}
          </Badge>
        ) : (
          <Button size="xs" leftSection={<BookPlus size={14} />} loading={pending} onClick={onSave}>
            {t('addToVocab')}
          </Button>
        )}
      </Group>
    </Stack>
  );
}

function AiWordCard({
  state,
  saved,
  pending,
  onSave,
  onRetry,
}: {
  state: AiState | undefined;
  saved: boolean;
  pending: boolean;
  onSave: (gloss: GlossData) => void;
  onRetry: () => void;
}) {
  const t = useTranslations('reader');
  if (!state || state.status === 'loading') {
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
