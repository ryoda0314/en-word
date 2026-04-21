'use client';

import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Divider,
  Group,
  Loader,
  Modal,
  Popover,
  Portal,
  Skeleton,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core';
import {
  AlertCircle,
  BookmarkCheck,
  BookPlus,
  Check,
  Quote,
  Sparkles,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';

import { PlayButton } from '@/components/common/PlayButton';
import { type GlossData, lookupGloss } from '@/lib/actions/gloss';
import { addToVocab } from '@/lib/actions/vocab';
import type { IdiomSpan, PassageToken } from '@/lib/text/tokenize';
import type { IdiomRow, WordRow } from '@/types/db';

import styles from './PassageReader.module.css';

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
  currentWordTokenId?: number | null;
};

type AiState =
  | { status: 'loading' }
  | { status: 'ready'; data: GlossData }
  | { status: 'error'; code: string };

function extractSentence(body: string, start: number, end: number): string {
  const stops = /[.!?\n]/;
  let s = start;
  while (s > 0 && !stops.test(body[s - 1])) s--;
  let e = end;
  while (e < body.length && !stops.test(body[e])) e++;
  if (e < body.length) e++;
  return body.slice(s, e).trim();
}

function groupByParagraph(tokens: PassageToken[]): PassageToken[][] {
  const paras: PassageToken[][] = [[]];
  for (const t of tokens) {
    if (t.kind === 'text' && /\n\s*\n/.test(t.text)) {
      const pieces = t.text.split(/(\n\s*\n)/);
      for (const piece of pieces) {
        if (/\n\s*\n/.test(piece)) {
          paras.push([]);
        } else if (piece.length > 0) {
          paras[paras.length - 1].push({ kind: 'text', text: piece });
        }
      }
    } else {
      paras[paras.length - 1].push(t);
    }
  }
  return paras.filter((p) => p.length > 0);
}

function normalizePhrase(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\s''-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function PassageReader({
  passageId,
  body,
  tokens,
  idiomSpans,
  wordsDict,
  idiomsDict,
  savedWordIds,
  savedIdiomIds,
  savedCustomTerms,
  currentWordTokenId,
}: Props) {
  const t = useTranslations('reader');
  const router = useRouter();
  const articleRef = useRef<HTMLElement>(null);

  const [openTokenId, setOpenTokenId] = useState<number | null>(null);
  const [savedWords, setSavedWords] = useState(() => new Set(savedWordIds));
  const [savedIdioms, setSavedIdioms] = useState(() => new Set(savedIdiomIds));
  const [savedCustoms, setSavedCustoms] = useState(
    () => new Set(savedCustomTerms.map((s) => s.toLowerCase())),
  );
  const [aiByTokenId, setAiByTokenId] = useState<Record<number, AiState>>({});
  const [pending, startTransition] = useTransition();

  const [phraseSel, setPhraseSel] = useState<{
    text: string;
    tokenIds: Set<number>;
    buttonTop: number;
    buttonLeft: number;
    groupRects: Array<{ top: number; left: number; width: number; height: number }>;
    context: string;
  } | null>(null);
  const [phraseModal, setPhraseModal] = useState<{
    text: string;
    context: string;
  } | null>(null);
  const [phraseAi, setPhraseAi] = useState<AiState | null>(null);

  const idiomSpanById = useMemo(
    () => new Map(idiomSpans.map((s) => [s.id, s])),
    [idiomSpans],
  );
  const paragraphs = useMemo(() => groupByParagraph(tokens), [tokens]);
  const tokenById = useMemo(() => {
    const m = new Map<number, Extract<PassageToken, { kind: 'word' }>>();
    for (const tk of tokens) if (tk.kind === 'word') m.set(tk.id, tk);
    return m;
  }, [tokens]);

  // Pointer-based drag tracking — replaces window.getSelection() so iOS's
  // native copy/translate callout never appears and overlaps our FAB.
  const dragStartIdRef = useRef<number | null>(null);
  const dragEndIdRef = useRef<number | null>(null);
  const dragActiveRef = useRef(false);
  const dragMultiTouchedRef = useRef(false);

  // ---- AI fetch for non-dict single words when their popover opens ----
  useEffect(() => {
    if (openTokenId === null) return;
    const token = tokenById.get(openTokenId);
    if (!token) return;
    // Skip if it's a dict word or inside an idiom span (shown from seeded data).
    if (token.wordId || token.idiomSpanIds.length > 0) return;
    if (aiByTokenId[openTokenId]) return;
    const context = extractSentence(body, token.charStart, token.charEnd);
    setAiByTokenId((prev) => ({ ...prev, [openTokenId]: { status: 'loading' } }));
    lookupGloss({ term: token.surface, kind: 'word', context }).then((res) => {
      setAiByTokenId((prev) => ({
        ...prev,
        [openTokenId]: res.ok
          ? { status: 'ready', data: res.gloss }
          : { status: 'error', code: res.error },
      }));
    });
  }, [openTokenId, tokenById, body, aiByTokenId]);

  // ---- Pointer-based phrase selection (replaces native Selection) ----
  // Token IDs are assigned in document order, so the inclusive [min, max]
  // range is exactly what the drag covers.
  const computePhraseSel = useCallback(
    (startId: number, endId: number) => {
      const article = articleRef.current;
      if (!article) return null;
      const lo = Math.min(startId, endId);
      const hi = Math.max(startId, endId);
      const ids: number[] = [];
      for (let i = lo; i <= hi; i++) if (tokenById.has(i)) ids.push(i);
      if (ids.length < 2) return null;

      const firstTok = tokenById.get(ids[0]);
      const lastTok = tokenById.get(ids[ids.length - 1]);
      if (!firstTok || !lastTok) return null;
      const firstEl = article.querySelector<HTMLElement>(
        `[data-token-id="${firstTok.id}"]`,
      );
      const lastEl = article.querySelector<HTMLElement>(
        `[data-token-id="${lastTok.id}"]`,
      );
      if (!firstEl || !lastEl) return null;

      const domRange = document.createRange();
      domRange.setStartBefore(firstEl);
      domRange.setEndAfter(lastEl);
      const rawRects = Array.from(domRange.getClientRects()).filter(
        (r) => r.width > 0 && r.height > 0,
      );
      const LINE_EPSILON = 3;
      const sortedRects = rawRects
        .slice()
        .sort((a, b) => a.top - b.top || a.left - b.left);
      const lineGroups: DOMRect[][] = [];
      for (const r of sortedRects) {
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
      const scrollY = window.scrollY;
      const scrollX = window.scrollX;
      const groupRects = lineGroups.map((line) => {
        const top = Math.min(...line.map((r) => r.top));
        const bottom = Math.max(...line.map((r) => r.bottom));
        const left = Math.min(...line.map((r) => r.left));
        const right = Math.max(...line.map((r) => r.right));
        return {
          top: top + scrollY,
          left: left + scrollX,
          width: right - left,
          height: bottom - top,
        };
      });
      const r1 = firstEl.getBoundingClientRect();
      const buttonTop = r1.top + scrollY;
      const buttonLeft = (r1.left + r1.right) / 2 + scrollX;
      const text = body
        .slice(firstTok.charStart, lastTok.charEnd)
        .replace(/\s+/g, ' ')
        .trim();
      const context = extractSentence(
        body,
        firstTok.charStart,
        lastTok.charEnd,
      );
      return {
        text,
        tokenIds: new Set(ids),
        buttonTop,
        buttonLeft,
        groupRects,
        context,
      };
    },
    [tokenById, body],
  );

  function tokenIdAtPoint(x: number, y: number): number | null {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    if (!el) return null;
    const span = el.closest<HTMLElement>('[data-token-id]');
    if (!span) return null;
    const n = Number(span.dataset.tokenId);
    return Number.isFinite(n) ? n : null;
  }

  function handlePointerDown(e: React.PointerEvent<HTMLElement>) {
    if (e.button !== undefined && e.button !== 0) return;
    const id = tokenIdAtPoint(e.clientX, e.clientY);
    if (id === null) return;
    dragStartIdRef.current = id;
    dragEndIdRef.current = id;
    dragActiveRef.current = true;
    dragMultiTouchedRef.current = false;
    setOpenTokenId(null);
    setPhraseSel(null);
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLElement>) {
    if (!dragActiveRef.current) return;
    const id = tokenIdAtPoint(e.clientX, e.clientY);
    if (id === null || id === dragEndIdRef.current) return;
    dragEndIdRef.current = id;
    if (id !== dragStartIdRef.current) dragMultiTouchedRef.current = true;
    const next = computePhraseSel(dragStartIdRef.current!, id);
    setPhraseSel(next);
  }

  function handlePointerUp() {
    if (!dragActiveRef.current) return;
    const startId = dragStartIdRef.current;
    const endId = dragEndIdRef.current;
    const multi = dragMultiTouchedRef.current;
    dragActiveRef.current = false;
    dragStartIdRef.current = null;
    dragEndIdRef.current = null;
    dragMultiTouchedRef.current = false;
    if (startId === null || endId === null) return;
    if (!multi || startId === endId) {
      // Single-token tap — open that token's popover.
      setOpenTokenId(startId);
      setPhraseSel(null);
    }
    // Multi-token: phraseSel already set by pointermove; leave FAB visible.
  }

  function handlePointerCancel() {
    // Browser hijacked the gesture (most commonly a scroll).
    dragActiveRef.current = false;
    dragStartIdRef.current = null;
    dragEndIdRef.current = null;
    dragMultiTouchedRef.current = false;
    setPhraseSel(null);
  }

  const openPhraseModal = useCallback(() => {
    if (!phraseSel) return;
    setPhraseModal({ text: phraseSel.text, context: phraseSel.context });
    setPhraseAi({ status: 'loading' });
    setPhraseSel(null);
    window.getSelection()?.removeAllRanges();
    lookupGloss({
      term: phraseSel.text,
      kind: 'phrase',
      context: phraseSel.context,
    }).then((res) => {
      setPhraseAi(
        res.ok
          ? { status: 'ready', data: res.gloss }
          : { status: 'error', code: res.error },
      );
    });
  }, [phraseSel]);

  // ---- Save actions ----
  function handleSaveWord(word: WordRow, contextSentence: string) {
    startTransition(async () => {
      const result = await addToVocab({
        wordId: word.id,
        passageId,
        contextSentence,
      });
      if (result.ok) {
        setSavedWords((prev) => new Set(prev).add(word.id));
        setOpenTokenId(null);
        router.refresh();
      }
    });
  }

  function handleSaveIdiom(idiom: IdiomRow, contextSentence: string) {
    startTransition(async () => {
      const result = await addToVocab({
        idiomId: idiom.id,
        passageId,
        contextSentence,
      });
      if (result.ok) {
        setSavedIdioms((prev) => new Set(prev).add(idiom.id));
        setOpenTokenId(null);
        router.refresh();
      }
    });
  }

  function handleSaveAiWord(
    gloss: GlossData,
    contextSentence: string,
    closeAfter: () => void,
  ) {
    startTransition(async () => {
      const result = gloss.wordId
        ? await addToVocab({
            wordId: gloss.wordId,
            passageId,
            contextSentence,
          })
        : await addToVocab({
            customTerm: gloss.headword,
            customMeaningJa: gloss.meaning_ja,
            passageId,
            contextSentence,
          });
      if (result.ok) {
        if (gloss.wordId) {
          setSavedWords((prev) => new Set(prev).add(gloss.wordId!));
        } else {
          setSavedCustoms((prev) =>
            new Set(prev).add(gloss.headword.toLowerCase()),
          );
        }
        closeAfter();
        router.refresh();
      }
    });
  }

  function handleSavePhrase(
    gloss: GlossData,
    contextSentence: string,
    closeAfter: () => void,
  ) {
    startTransition(async () => {
      const result = gloss.idiomId
        ? await addToVocab({
            idiomId: gloss.idiomId,
            passageId,
            contextSentence,
          })
        : await addToVocab({
            customTerm: gloss.headword,
            customMeaningJa: gloss.meaning_ja,
            passageId,
            contextSentence,
          });
      if (result.ok) {
        if (gloss.idiomId) {
          setSavedIdioms((prev) => new Set(prev).add(gloss.idiomId!));
        } else {
          setSavedCustoms((prev) =>
            new Set(prev).add(gloss.headword.toLowerCase()),
          );
        }
        closeAfter();
        router.refresh();
      }
    });
  }

  return (
    <>
      <article
        ref={articleRef}
        className={styles.passage}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        {paragraphs.map((para, pIdx) => (
          <p key={pIdx} className={styles.paragraph}>
            {para.map((token, i) => {
              if (token.kind === 'text') {
                const prev = para[i - 1];
                const next = para[i + 1];
                const bridgeSelected =
                  prev?.kind === 'word' &&
                  next?.kind === 'word' &&
                  phraseSel !== null &&
                  phraseSel.tokenIds.has(prev.id) &&
                  phraseSel.tokenIds.has(next.id);
                return (
                  <span
                    key={`t-${pIdx}-${i}`}
                    className={
                      bridgeSelected ? styles.inSelection : undefined
                    }
                  >
                    {token.text.replace(/\n/g, ' ')}
                  </span>
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
              const word = token.wordId
                ? (wordsDict[token.wordId] ?? null)
                : null;

              const isDict = !!word || !!idiom;
              const isSaved = Boolean(
                (idiom && savedIdioms.has(idiom.id)) ||
                  (word && savedWords.has(word.id)) ||
                  savedCustoms.has(token.surface.toLowerCase()),
              );

              const contextSentence = idiomSpan
                ? extractSentence(body, idiomSpan.charStart, idiomSpan.charEnd)
                : extractSentence(body, token.charStart, token.charEnd);

              const isInSelection = phraseSel?.tokenIds.has(token.id) ?? false;
              const isCurrentlyRead = currentWordTokenId === token.id;
              const className = [
                styles.token,
                isDict ? null : styles.unknown,
                word ? styles.inDict : null,
                idiom ? styles.inIdiom : null,
                isSaved ? styles.saved : null,
                isInSelection ? styles.inSelection : null,
                isCurrentlyRead ? styles.currentlyReading : null,
              ]
                .filter(Boolean)
                .join(' ');

              return (
                <Popover
                  key={`w-${token.id}`}
                  opened={openTokenId === token.id}
                  onChange={(open) =>
                    setOpenTokenId(open ? token.id : null)
                  }
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
                        saved={savedIdioms.has(idiom.id)}
                        pending={pending}
                        onSave={() => handleSaveIdiom(idiom, contextSentence)}
                        word={word && !savedWords.has(word.id) ? word : null}
                        onSaveWord={
                          word
                            ? () => handleSaveWord(word, contextSentence)
                            : undefined
                        }
                      />
                    ) : word ? (
                      <WordCard
                        word={word}
                        saved={savedWords.has(word.id)}
                        pending={pending}
                        onSave={() => handleSaveWord(word, contextSentence)}
                      />
                    ) : (
                      <AiWordCard
                        state={aiByTokenId[token.id]}
                        saved={savedCustoms.has(token.surface.toLowerCase())}
                        pending={pending}
                        onSave={(gloss) =>
                          handleSaveAiWord(gloss, contextSentence, () =>
                            setOpenTokenId(null),
                          )
                        }
                        onRetry={() => {
                          const ctx = extractSentence(
                            body,
                            token.charStart,
                            token.charEnd,
                          );
                          setAiByTokenId((prev) => ({
                            ...prev,
                            [token.id]: { status: 'loading' },
                          }));
                          lookupGloss({
                            term: token.surface,
                            kind: 'word',
                            context: ctx,
                          }).then((res) =>
                            setAiByTokenId((prev) => ({
                              ...prev,
                              [token.id]: res.ok
                                ? { status: 'ready', data: res.gloss }
                                : { status: 'error', code: res.error },
                            })),
                          );
                        }}
                      />
                    )}
                  </Popover.Dropdown>
                </Popover>
              );
            })}
          </p>
        ))}
      </article>

      {phraseSel ? (
        <Portal>
          {phraseSel.groupRects.map((r, i) => (
            <div
              key={i}
              className={styles.phraseOutline}
              style={{
                top: r.top - 2,
                left: r.left - 2,
                width: r.width + 4,
                height: r.height + 4,
              }}
              aria-hidden
            />
          ))}
          <div
            className={styles.phraseFab}
            style={{
              top: phraseSel.buttonTop,
              left: phraseSel.buttonLeft,
            }}
          >
            <Button
              size="xs"
              leftSection={<Quote size={14} />}
              variant="filled"
              onMouseDown={(e) => {
                // Prevent selection from collapsing on mousedown before click.
                e.preventDefault();
                openPhraseModal();
              }}
            >
              {t('lookupPhrase')} ({phraseSel.tokenIds.size})
            </Button>
          </div>
        </Portal>
      ) : null}

      <Modal
        opened={phraseModal !== null}
        onClose={() => {
          setPhraseModal(null);
          setPhraseAi(null);
        }}
        title={
          phraseModal ? (
            <Group gap="xs">
              <Sparkles size={16} />
              <Text fw={600}>{phraseModal.text}</Text>
            </Group>
          ) : null
        }
        size="md"
      >
        {phraseModal && phraseAi ? (
          <PhraseLookupBody
            phraseText={phraseModal.text}
            context={phraseModal.context}
            state={phraseAi}
            pending={pending}
            saved={savedCustoms.has(phraseModal.text.toLowerCase())}
            onSave={(gloss) =>
              handleSavePhrase(gloss, phraseModal.context, () => {
                setPhraseModal(null);
                setPhraseAi(null);
              })
            }
          />
        ) : null}
      </Modal>
    </>
  );
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
        <Text fw={700} fz="lg">
          {word.lemma}
        </Text>
        <PlayButton text={word.lemma} size={14} />
        {word.pos ? (
          <Badge size="xs" variant="default">
            {word.pos}
          </Badge>
        ) : null}
        {word.ipa ? (
          <Text c="dimmed" size="xs" ff="monospace">
            {word.ipa}
          </Text>
        ) : null}
      </Group>
      {word.meaning_ja ? <Text size="sm">{word.meaning_ja}</Text> : null}
      {word.meaning_en ? (
        <Text c="dimmed" size="xs" lh={1.5}>
          {word.meaning_en}
        </Text>
      ) : null}
      {word.example_en ? (
        <>
          <Divider my={4} />
          <Text size="xs" fs="italic">
            {word.example_en}
          </Text>
          {word.example_ja ? (
            <Text c="dimmed" size="xs">
              {word.example_ja}
            </Text>
          ) : null}
        </>
      ) : null}
      <Group mt={6} justify="flex-end">
        {saved ? (
          <Badge
            color="teal"
            variant="light"
            leftSection={<BookmarkCheck size={12} />}
          >
            {t('saved')}
          </Badge>
        ) : (
          <Button
            size="xs"
            leftSection={<BookPlus size={14} />}
            loading={pending}
            onClick={onSave}
          >
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
  word,
  onSaveWord,
}: {
  idiom: IdiomRow;
  saved: boolean;
  pending: boolean;
  onSave: () => void;
  word: WordRow | null;
  onSaveWord?: () => void;
}) {
  const t = useTranslations('reader');
  return (
    <Stack gap="xs">
      <Group gap={6} wrap="wrap" align="center">
        <Badge size="xs" color="indigo" variant="light">
          {t('idiomBadge')}
        </Badge>
        <Text fw={700} fz="md">
          {idiom.phrase}
        </Text>
        <PlayButton text={idiom.phrase} size={14} />
      </Group>
      {idiom.meaning_ja ? <Text size="sm">{idiom.meaning_ja}</Text> : null}
      {idiom.meaning_en ? (
        <Text c="dimmed" size="xs" lh={1.5}>
          {idiom.meaning_en}
        </Text>
      ) : null}
      {idiom.example_en ? (
        <>
          <Divider my={4} />
          <Text size="xs" fs="italic">
            {idiom.example_en}
          </Text>
          {idiom.example_ja ? (
            <Text c="dimmed" size="xs">
              {idiom.example_ja}
            </Text>
          ) : null}
        </>
      ) : null}
      <Group mt={6} justify="space-between">
        {word && onSaveWord ? (
          <Tooltip label={t('saveWordAlso', { word: word.lemma })} withArrow>
            <ActionIcon
              variant="subtle"
              size="md"
              onClick={onSaveWord}
              aria-label={t('saveWordAlso', { word: word.lemma })}
            >
              <BookPlus size={16} />
            </ActionIcon>
          </Tooltip>
        ) : (
          <span />
        )}
        {saved ? (
          <Badge color="teal" variant="light" leftSection={<Check size={12} />}>
            {t('saved')}
          </Badge>
        ) : (
          <Button
            size="xs"
            leftSection={<BookPlus size={14} />}
            loading={pending}
            onClick={onSave}
          >
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
          <Text size="xs" c="dimmed">
            {t('lookingUp')}
          </Text>
        </Group>
        <Skeleton height={14} radius="sm" />
        <Skeleton height={14} radius="sm" width="70%" />
      </Stack>
    );
  }
  if (state.status === 'error') {
    const msg =
      state.code === 'RATE_LIMITED'
        ? t('rateLimited')
        : state.code === 'UNAUTHENTICATED'
          ? t('notSignedIn')
          : t('aiFailed');
    return (
      <Stack gap="xs">
        <Alert
          color="red"
          variant="light"
          icon={<AlertCircle size={14} />}
          p="xs"
        >
          <Text size="xs">{msg}</Text>
        </Alert>
        <Button size="xs" variant="light" onClick={onRetry}>
          {t('retry')}
        </Button>
      </Stack>
    );
  }
  const gloss = state.data;
  return (
    <Stack gap="xs">
      <Group gap={6} wrap="wrap" align="center">
        <Text fw={700} fz="lg">
          {gloss.headword}
        </Text>
        <PlayButton text={gloss.headword} size={14} />
        {gloss.pos ? (
          <Badge size="xs" variant="default">
            {gloss.pos}
          </Badge>
        ) : null}
        {gloss.ipa ? (
          <Text c="dimmed" size="xs" ff="monospace">
            {gloss.ipa}
          </Text>
        ) : null}
        <Badge size="xs" color="grape" variant="light">
          <Group gap={4} wrap="nowrap">
            <Sparkles size={10} />
            {t('aiBadge')}
          </Group>
        </Badge>
      </Group>
      {gloss.meaning_ja ? <Text size="sm">{gloss.meaning_ja}</Text> : null}
      {gloss.meaning_en ? (
        <Text c="dimmed" size="xs" lh={1.5}>
          {gloss.meaning_en}
        </Text>
      ) : null}
      {gloss.example_en ? (
        <>
          <Divider my={4} />
          <Text size="xs" fs="italic">
            {gloss.example_en}
          </Text>
          {gloss.example_ja ? (
            <Text c="dimmed" size="xs">
              {gloss.example_ja}
            </Text>
          ) : null}
        </>
      ) : null}
      <Group mt={6} justify="flex-end">
        {saved ? (
          <Badge
            color="teal"
            variant="light"
            leftSection={<BookmarkCheck size={12} />}
          >
            {t('saved')}
          </Badge>
        ) : (
          <Button
            size="xs"
            leftSection={<BookPlus size={14} />}
            loading={pending}
            onClick={() => onSave(gloss)}
          >
            {t('addToVocab')}
          </Button>
        )}
      </Group>
    </Stack>
  );
}

function PhraseLookupBody({
  phraseText,
  context,
  state,
  pending,
  saved,
  onSave,
}: {
  phraseText: string;
  context: string;
  state: AiState;
  pending: boolean;
  saved: boolean;
  onSave: (gloss: GlossData) => void;
}) {
  const t = useTranslations('reader');

  if (state.status === 'loading') {
    return (
      <Stack gap="sm">
        <Group gap="xs">
          <Loader size="xs" />
          <Text size="sm" c="dimmed">
            {t('lookingUp')}
          </Text>
        </Group>
        <Skeleton height={16} radius="sm" />
        <Skeleton height={16} radius="sm" width="80%" />
        <Skeleton height={14} radius="sm" width="60%" />
      </Stack>
    );
  }
  if (state.status === 'error') {
    const msg =
      state.code === 'RATE_LIMITED'
        ? t('rateLimited')
        : state.code === 'UNAUTHENTICATED'
          ? t('notSignedIn')
          : t('aiFailed');
    return (
      <Alert color="red" icon={<AlertCircle size={16} />} variant="light">
        {msg}
      </Alert>
    );
  }

  const gloss = state.data;
  return (
    <Stack gap="sm">
      <Group gap={6} wrap="wrap">
        <Badge color="indigo" variant="light" size="sm">
          {t('phraseBadge')}
        </Badge>
        {gloss.source === 'dict' ? (
          <Badge color="gray" variant="default" size="xs">
            {t('fromDict')}
          </Badge>
        ) : (
          <Badge color="grape" variant="light" size="xs">
            <Group gap={4} wrap="nowrap">
              <Sparkles size={10} />
              {t('aiBadge')}
            </Group>
          </Badge>
        )}
      </Group>
      <Text fw={700} fz="lg">
        {gloss.headword}
      </Text>
      {gloss.meaning_ja ? <Text size="sm">{gloss.meaning_ja}</Text> : null}
      {gloss.meaning_en ? (
        <Text c="dimmed" size="sm" lh={1.5}>
          {gloss.meaning_en}
        </Text>
      ) : null}
      {gloss.example_en ? (
        <>
          <Divider my={4} />
          <Text size="sm" fs="italic">
            {gloss.example_en}
          </Text>
          {gloss.example_ja ? (
            <Text c="dimmed" size="sm">
              {gloss.example_ja}
            </Text>
          ) : null}
        </>
      ) : null}
      {context ? (
        <>
          <Divider my={4} />
          <Text size="xs" c="dimmed">
            {t('inThisPassage')}
          </Text>
          <Text size="xs" fs="italic" c="dimmed">
            {context}
          </Text>
        </>
      ) : null}
      <Group mt="sm" justify="flex-end">
        {saved ? (
          <Badge color="teal" variant="light" leftSection={<Check size={12} />}>
            {t('saved')}
          </Badge>
        ) : (
          <Button
            leftSection={<BookPlus size={14} />}
            loading={pending}
            onClick={() => onSave(gloss)}
          >
            {t('addToVocab')}
          </Button>
        )}
      </Group>
    </Stack>
  );
}
