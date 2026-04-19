'use client';

import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Paper,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Title,
} from '@mantine/core';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Pause,
  PictureInPicture2,
  Play,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import { PlayButton } from '@/components/common/PlayButton';
import type { VocabStage } from '@/types/db';

type JoinedWord = {
  lemma: string;
  meaning_ja: string | null;
  meaning_en: string | null;
  example_en: string | null;
  example_ja: string | null;
  pos: string | null;
  ipa: string | null;
};

type JoinedIdiom = {
  phrase: string;
  meaning_ja: string | null;
  meaning_en: string | null;
  example_en: string | null;
  example_ja: string | null;
};

export type TickerCard = {
  id: string;
  stage: VocabStage;
  custom_term: string | null;
  custom_meaning_ja: string | null;
  context_sentence: string | null;
  next_review_at: string;
  created_at: string;
  lapses: number;
  word: JoinedWord | null;
  idiom: JoinedIdiom | null;
};

type Source = 'all' | 'due' | 'notMastered' | 'lapsed' | 'recent';
type Detail = 'min' | 'full';
type IntervalValue = '3' | '5' | '8' | '15';

function nonEmpty(s: string | null | undefined): string {
  return s && s.trim() ? s.trim() : '';
}

function displayName(c: TickerCard): string {
  return (
    nonEmpty(c.word?.lemma) ||
    nonEmpty(c.idiom?.phrase) ||
    nonEmpty(c.custom_term)
  );
}
function displayMeaning(c: TickerCard): string {
  return (
    nonEmpty(c.word?.meaning_ja) ||
    nonEmpty(c.idiom?.meaning_ja) ||
    nonEmpty(c.custom_meaning_ja)
  );
}
function displayExample(c: TickerCard): string {
  return nonEmpty(c.word?.example_en) || nonEmpty(c.idiom?.example_en);
}
function displayIpa(c: TickerCard): string {
  return nonEmpty(c.word?.ipa);
}
function displayPos(c: TickerCard): string {
  return nonEmpty(c.word?.pos) || (c.idiom ? 'phrase' : '');
}

function applyFilter(cards: TickerCard[], source: Source): TickerCard[] {
  const now = Date.now();
  switch (source) {
    case 'all':
      return cards;
    case 'due':
      return cards.filter(
        (c) =>
          c.stage !== 'mastered' &&
          new Date(c.next_review_at).getTime() <= now,
      );
    case 'notMastered':
      return cards.filter((c) => c.stage !== 'mastered');
    case 'lapsed':
      return cards.filter((c) => c.lapses > 0 && c.stage !== 'mastered');
    case 'recent':
      return cards.slice(0, 30);
  }
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function TickerClient({ cards }: { cards: TickerCard[] }) {
  const t = useTranslations('ticker');

  const [source, setSource] = useState<Source>('notMastered');
  const [intervalSec, setIntervalSec] = useState<IntervalValue>('5');
  const [detail, setDetail] = useState<Detail>('min');
  const [shuffle, setShuffle] = useState(true);
  const [paused, setPaused] = useState(false);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const [pipSupported, setPipSupported] = useState(false);
  const [pipError, setPipError] = useState<string | null>(null);

  useEffect(() => {
    const supported =
      typeof window !== 'undefined' &&
      'documentPictureInPicture' in window;
    setPipSupported(Boolean(supported));
  }, []);

  const activeCards = useMemo(() => {
    const filtered = applyFilter(cards, source);
    return shuffle ? shuffleArray(filtered) : filtered;
  }, [cards, source, shuffle]);

  useEffect(() => {
    setIndex(0);
  }, [source, shuffle]);

  // Reset reveal state on each new card.
  useEffect(() => {
    setRevealed(false);
  }, [index]);

  // Auto-advance between cards.
  useEffect(() => {
    if (paused || activeCards.length <= 1) return;
    const id = window.setInterval(
      () => {
        setIndex((i) => (i + 1) % activeCards.length);
      },
      Number(intervalSec) * 1000,
    );
    return () => window.clearInterval(id);
  }, [paused, intervalSec, activeCards.length]);

  // Reveal the meaning partway through each card's interval.
  useEffect(() => {
    if (paused || revealed) return;
    const halfway = Number(intervalSec) * 500; // ms
    const id = window.setTimeout(() => setRevealed(true), halfway);
    return () => window.clearTimeout(id);
  }, [index, paused, intervalSec, revealed]);

  const current = activeCards.length > 0 ? activeCards[index % activeCards.length] : null;

  const prev = useCallback(() => {
    if (activeCards.length === 0) return;
    setIndex((i) => (i - 1 + activeCards.length) % activeCards.length);
  }, [activeCards.length]);
  const next = useCallback(() => {
    if (activeCards.length === 0) return;
    setIndex((i) => (i + 1) % activeCards.length);
  }, [activeCards.length]);
  const togglePause = useCallback(() => setPaused((p) => !p), []);
  const reveal = useCallback(() => setRevealed(true), []);

  async function openPip() {
    setPipError(null);
    const api = (window as unknown as {
      documentPictureInPicture?: {
        requestWindow: (opts?: {
          width?: number;
          height?: number;
        }) => Promise<Window>;
      };
    }).documentPictureInPicture;

    if (!api) {
      setPipError(t('pipUnsupported'));
      return;
    }

    try {
      const pip = await api.requestWindow({ width: 360, height: 220 });

      // Propagate Mantine color scheme.
      const rootEl = document.documentElement;
      pip.document.documentElement.setAttribute(
        'data-mantine-color-scheme',
        rootEl.getAttribute('data-mantine-color-scheme') ?? 'light',
      );
      pip.document.documentElement.className = rootEl.className;

      // Copy every stylesheet from the main document.
      const sheets = Array.from(document.styleSheets);
      for (const sheet of sheets) {
        try {
          const css = Array.from(sheet.cssRules)
            .map((r) => r.cssText)
            .join('\n');
          const el = pip.document.createElement('style');
          el.textContent = css;
          pip.document.head.appendChild(el);
        } catch {
          if (sheet.href) {
            const link = pip.document.createElement('link');
            link.rel = 'stylesheet';
            link.href = sheet.href;
            pip.document.head.appendChild(link);
          }
        }
      }
      pip.document.body.style.margin = '0';
      pip.document.body.style.fontFamily = 'var(--mantine-font-family)';
      pip.document.body.style.background = 'var(--mantine-color-body)';
      pip.document.body.style.color = 'var(--mantine-color-text)';

      pip.addEventListener('pagehide', () => setPipWindow(null));
      setPipWindow(pip);
    } catch (err) {
      console.error('PiP failed', err);
      setPipError(t('pipFailed'));
    }
  }

  function closePip() {
    if (pipWindow && !pipWindow.closed) pipWindow.close();
    setPipWindow(null);
  }

  const tickerView = current ? (
    <TickerView
      card={current}
      detail={detail}
      paused={paused}
      revealed={revealed}
      index={index}
      total={activeCards.length}
      onPrev={prev}
      onNext={next}
      onPauseToggle={togglePause}
      onReveal={reveal}
      compact={pipWindow !== null}
    />
  ) : (
    <EmptyState message={t('empty')} />
  );

  return (
    <>
      <Stack gap="lg">
        <Paper withBorder radius="md" p="lg">
          <Stack gap="md">
            <Text fw={600}>{t('settings')}</Text>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <Select
                label={t('sourceLabel')}
                description={t('sourceDesc')}
                value={source}
                onChange={(v) => v && setSource(v as Source)}
                allowDeselect={false}
                data={[
                  { value: 'notMastered', label: t('src.notMastered') },
                  { value: 'due', label: t('src.due') },
                  { value: 'lapsed', label: t('src.lapsed') },
                  { value: 'recent', label: t('src.recent') },
                  { value: 'all', label: t('src.all') },
                ]}
              />
              <Select
                label={t('intervalLabel')}
                description={t('intervalDesc')}
                value={intervalSec}
                onChange={(v) => v && setIntervalSec(v as IntervalValue)}
                allowDeselect={false}
                data={[
                  { value: '3', label: t('every', { n: 3 }) },
                  { value: '5', label: t('every', { n: 5 }) },
                  { value: '8', label: t('every', { n: 8 }) },
                  { value: '15', label: t('every', { n: 15 }) },
                ]}
              />
            </SimpleGrid>
            <Group gap="md" wrap="wrap" align="center">
              <SegmentedControl
                value={detail}
                onChange={(v) => setDetail(v as Detail)}
                data={[
                  { value: 'min', label: t('detailMin') },
                  { value: 'full', label: t('detailFull') },
                ]}
                size="xs"
              />
              <Switch
                label={t('shuffle')}
                checked={shuffle}
                onChange={(e) => setShuffle(e.currentTarget.checked)}
              />
              <Badge color="gray" variant="light">
                {t('count', { count: activeCards.length })}
              </Badge>
            </Group>
          </Stack>
        </Paper>

        {pipSupported ? (
          <Group gap="xs">
            {pipWindow ? (
              <Button
                onClick={closePip}
                variant="default"
                leftSection={<PictureInPicture2 size={14} />}
              >
                {t('closePip')}
              </Button>
            ) : (
              <Button
                onClick={openPip}
                leftSection={<PictureInPicture2 size={14} />}
              >
                {t('openPip')}
              </Button>
            )}
            <Text c="dimmed" size="xs">
              {t('pipHint')}
            </Text>
          </Group>
        ) : (
          <Alert
            color="gray"
            variant="light"
            icon={<AlertCircle size={14} />}
          >
            <Text size="xs">{t('pipUnsupported')}</Text>
          </Alert>
        )}

        {pipError ? (
          <Alert color="red" variant="light" icon={<AlertCircle size={14} />}>
            {pipError}
          </Alert>
        ) : null}

        <Paper withBorder radius="md" p={{ base: 'md', md: 'lg' }}>
          {pipWindow ? (
            <Stack gap="sm" align="center" py="xl">
              <PictureInPicture2 size={24} />
              <Text c="dimmed" size="sm" ta="center">
                {t('playingInPip')}
              </Text>
              <Button onClick={closePip} variant="subtle" size="xs">
                {t('closePip')}
              </Button>
            </Stack>
          ) : (
            tickerView
          )}
        </Paper>
      </Stack>

      {pipWindow
        ? createPortal(
            <div
              style={{
                boxSizing: 'border-box',
                height: '100vh',
                width: '100vw',
                display: 'flex',
                padding: 8,
              }}
            >
              {tickerView}
            </div>,
            pipWindow.document.body,
          )
        : null}
    </>
  );
}

function TickerView({
  card,
  detail,
  paused,
  revealed,
  index,
  total,
  onPrev,
  onNext,
  onPauseToggle,
  onReveal,
  compact,
}: {
  card: TickerCard;
  detail: Detail;
  paused: boolean;
  revealed: boolean;
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onPauseToggle: () => void;
  onReveal: () => void;
  compact: boolean;
}) {
  const t = useTranslations('ticker');
  const name = displayName(card);
  const meaning = displayMeaning(card);
  const example = displayExample(card);
  const ipa = displayIpa(card);
  const pos = displayPos(card);

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: compact ? '100%' : 200,
        width: '100%',
      }}
    >
      <div
        onClick={() => {
          if (!revealed) onReveal();
        }}
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: revealed ? 'default' : 'pointer',
          userSelect: 'none',
        }}
        role={revealed ? undefined : 'button'}
        aria-label={revealed ? undefined : t('tapToReveal')}
      >
        <Stack gap={4} align="center">
          <Group gap={6} wrap="wrap" justify="center">
            {pos ? (
              <Badge size="xs" variant="default">
                {pos}
              </Badge>
            ) : null}
            {ipa ? (
              <Text size="xs" c="dimmed" ff="monospace">
                {ipa}
              </Text>
            ) : null}
            <Text c="dimmed" size="xs">
              {index + 1} / {total}
            </Text>
          </Group>
          <Group gap="xs" justify="center" align="center">
            <Title
              order={2}
              ta="center"
              fz={compact ? 24 : 32}
              lh={1.15}
              style={{ wordBreak: 'break-word' }}
            >
              {name}
            </Title>
            {name ? (
              <div onClick={(e) => e.stopPropagation()}>
                <PlayButton text={name} size={18} variant="light" />
              </div>
            ) : null}
          </Group>
          {revealed ? (
            <>
              {meaning ? (
                <Text ta="center" size={compact ? 'sm' : 'md'} c="dimmed">
                  {meaning}
                </Text>
              ) : null}
              {detail === 'full' && example ? (
                <Text
                  ta="center"
                  size="xs"
                  fs="italic"
                  c="dimmed"
                  mt={4}
                  style={{ wordBreak: 'break-word' }}
                >
                  {example}
                </Text>
              ) : null}
            </>
          ) : (
            <Text c="dimmed" size="xs" mt={4}>
              {t('tapToReveal')}
            </Text>
          )}
        </Stack>
      </div>
      <Group justify="center" gap="xs" mt={compact ? 4 : 'sm'}>
        <ActionIcon
          variant="subtle"
          size="md"
          onClick={onPrev}
          aria-label={t('prev')}
        >
          <ChevronLeft size={16} />
        </ActionIcon>
        <ActionIcon
          variant="light"
          size="md"
          onClick={onPauseToggle}
          aria-label={paused ? t('play') : t('pause')}
        >
          {paused ? <Play size={14} /> : <Pause size={14} />}
        </ActionIcon>
        <ActionIcon
          variant="subtle"
          size="md"
          onClick={onNext}
          aria-label={t('next')}
        >
          <ChevronRight size={16} />
        </ActionIcon>
      </Group>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <Card withBorder radius="sm" p="xl" style={{ width: '100%' }}>
      <Text c="dimmed" ta="center" size="sm">
        {message}
      </Text>
    </Card>
  );
}
