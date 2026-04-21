'use client';

import {
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Loader,
  Paper,
  Progress,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import {
  AlertCircle,
  ArrowRight,
  Check,
  CircleCheckBig,
  Eye,
  Sparkles,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useState, useTransition } from 'react';

import { StageBadge } from '@/components/vocab/StageBadge';
import { gradeSentence, type GradeData } from '@/lib/actions/grade';
import { submitReview } from '@/lib/actions/review';
import { gradeToQuality } from '@/lib/srs/sm2';
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

export type ReviewCard = {
  id: string;
  stage: VocabStage;
  custom_term: string | null;
  custom_meaning_ja: string | null;
  context_sentence: string | null;
  word: JoinedWord | null;
  idiom: JoinedIdiom | null;
};

type Result = {
  card: ReviewCard;
  quality: number;
  stageBefore: VocabStage;
  stageAfter: VocabStage;
  intervalDays: number;
};

function nonEmpty(s: string | null | undefined): string {
  return s && s.trim() ? s.trim() : '';
}

function displayName(card: ReviewCard): string {
  return (
    nonEmpty(card.word?.lemma) ||
    nonEmpty(card.idiom?.phrase) ||
    nonEmpty(card.custom_term)
  );
}

function displayMeaningJa(card: ReviewCard): string {
  return (
    nonEmpty(card.word?.meaning_ja) ||
    nonEmpty(card.idiom?.meaning_ja) ||
    nonEmpty(card.custom_meaning_ja)
  );
}

function displayMeaningEn(card: ReviewCard): string {
  return nonEmpty(card.word?.meaning_en) || nonEmpty(card.idiom?.meaning_en);
}

function displayExample(card: ReviewCard): { en: string; ja: string } {
  if (nonEmpty(card.word?.example_en)) {
    return {
      en: card.word!.example_en!,
      ja: nonEmpty(card.word?.example_ja),
    };
  }
  if (nonEmpty(card.idiom?.example_en)) {
    return {
      en: card.idiom!.example_en!,
      ja: nonEmpty(card.idiom?.example_ja),
    };
  }
  return { en: nonEmpty(card.context_sentence), ja: '' };
}

export function ReviewSession({
  cards,
  locale,
  onExitHref,
}: {
  cards: ReviewCard[];
  locale: string;
  onExitHref: string;
}) {
  const t = useTranslations('review');
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Result[]>([]);
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [cardKey, setCardKey] = useState(0);

  const handleAnswer = useCallback(
    (card: ReviewCard) => (quality: number) => {
      if (busy) return;
      setBusy(true);
      startTransition(async () => {
        const result = await submitReview({ userVocabId: card.id, quality });
        if (result.ok) {
          setResults((prev) => [
            ...prev,
            {
              card,
              quality,
              stageBefore: result.stageBefore as VocabStage,
              stageAfter: result.stageAfter as VocabStage,
              intervalDays: result.intervalDays,
            },
          ]);
          setIndex((i) => i + 1);
          setCardKey((k) => k + 1);
        }
        setBusy(false);
      });
    },
    [busy],
  );

  if (cards.length === 0) {
    return (
      <Stack gap="md" align="flex-start">
        <Title order={2}>{t('allClearTitle')}</Title>
        <Text c="dimmed">{t('allClearBody')}</Text>
        <Button component="a" href={onExitHref} variant="light">
          {t('backHome')}
        </Button>
      </Stack>
    );
  }

  if (index >= cards.length) {
    return <SessionSummary results={results} exitHref={onExitHref} locale={locale} />;
  }

  const card = cards[index];

  return (
    <Stack gap="md" maw={680}>
      <Group justify="space-between" align="center">
        <Text size="sm" c="dimmed" fw={500}>
          {index + 1} / {cards.length}
        </Text>
        <StageBadge stage={card.stage} />
      </Group>
      <Progress
        value={((index + 1) / cards.length) * 100}
        size="sm"
        color="indigo"
      />

      <Paper withBorder radius="md" p="lg">
        {card.stage === 'memorize' ? (
          <MemorizeCard key={cardKey} card={card} busy={busy} onRate={handleAnswer(card)} />
        ) : card.stage === 'recognize' ? (
          <RecognizeCard key={cardKey} card={card} busy={busy} onRate={handleAnswer(card)} />
        ) : (
          <ProduceCard key={cardKey} card={card} busy={busy} onRate={handleAnswer(card)} />
        )}
      </Paper>
    </Stack>
  );
}

function MemorizeCard({
  card,
  busy,
  onRate,
}: {
  card: ReviewCard;
  busy: boolean;
  onRate: (quality: number) => void;
}) {
  const t = useTranslations('review');
  const [revealed, setRevealed] = useState(false);
  const name = displayName(card);
  const mja = displayMeaningJa(card);
  const men = displayMeaningEn(card);
  const ex = displayExample(card);
  const pos = card.word?.pos ?? (card.idiom ? 'phrase' : null);
  const ipa = card.word?.ipa ?? '';

  return (
    <Stack gap="md" align="center">
      <Stack gap={4} align="center">
        <Group gap="xs" wrap="wrap" justify="center">
          {pos ? (
            <Badge size="xs" variant="default">
              {pos}
            </Badge>
          ) : null}
          {ipa ? (
            <Text c="dimmed" size="xs" ff="monospace">
              {ipa}
            </Text>
          ) : null}
        </Group>
        <Title order={1} ta="center" size={36}>
          {name}
        </Title>
      </Stack>

      {!revealed ? (
        <Button
          leftSection={<Eye size={16} />}
          onClick={() => setRevealed(true)}
          variant="light"
          size="md"
        >
          {t('reveal')}
        </Button>
      ) : (
        <Stack gap="md" w="100%">
          <Divider />
          {mja ? <Text ta="center" size="lg">{mja}</Text> : null}
          {men ? (
            <Text ta="center" size="sm" c="dimmed">
              {men}
            </Text>
          ) : null}
          {ex.en ? (
            <Stack gap={2} mt="xs">
              <Text size="sm" fs="italic" ta="center">
                {ex.en}
              </Text>
              {ex.ja ? (
                <Text size="xs" c="dimmed" ta="center">
                  {ex.ja}
                </Text>
              ) : null}
            </Stack>
          ) : null}
          <RateButtons onRate={onRate} disabled={busy} />
        </Stack>
      )}
    </Stack>
  );
}

function RecognizeCard({
  card,
  busy,
  onRate,
}: {
  card: ReviewCard;
  busy: boolean;
  onRate: (quality: number) => void;
}) {
  const t = useTranslations('review');
  const [answer, setAnswer] = useState('');
  const [revealed, setRevealed] = useState(false);
  const name = displayName(card);
  const mja = displayMeaningJa(card);
  const ex = displayExample(card);

  const userCorrect =
    answer.trim().toLowerCase() === name.toLowerCase() && answer.trim().length > 0;

  return (
    <Stack gap="md">
      <Stack gap={4}>
        <Text c="dimmed" size="xs" tt="uppercase" fw={500}>
          {t('meaningPrompt')}
        </Text>
        <Text size="lg">{mja}</Text>
      </Stack>

      <TextInput
        placeholder={t('typeAnswerPlaceholder')}
        value={answer}
        onChange={(e) => setAnswer(e.currentTarget.value)}
        disabled={revealed}
        size="md"
      />

      {!revealed ? (
        <Button
          leftSection={<Eye size={16} />}
          onClick={() => setRevealed(true)}
          variant="light"
        >
          {t('check')}
        </Button>
      ) : (
        <Stack gap="sm">
          <Group justify="space-between" wrap="wrap">
            <Group gap="xs">
              <Text size="sm" c="dimmed">
                {t('yourAnswer')}:
              </Text>
              <Text size="sm" fw={500}>
                {answer.trim() || t('noInput')}
              </Text>
              {userCorrect ? (
                <Badge color="teal" leftSection={<Check size={12} />} size="xs">
                  {t('correct')}
                </Badge>
              ) : null}
            </Group>
            <Group gap="xs">
              <Text size="sm" c="dimmed">
                {t('answer')}:
              </Text>
              <Text size="sm" fw={600}>
                {name}
              </Text>
            </Group>
          </Group>
          {ex.ja ? (
            <Text size="xs" c="dimmed">
              {ex.ja}
            </Text>
          ) : null}
          <Divider />
          <RateButtons onRate={onRate} disabled={busy} />
        </Stack>
      )}
    </Stack>
  );
}

function ProduceCard({
  card,
  busy,
  onRate,
}: {
  card: ReviewCard;
  busy: boolean;
  onRate: (quality: number) => void;
}) {
  const t = useTranslations('review');
  const [sentence, setSentence] = useState('');
  const [gradeState, setGradeState] = useState<
    { status: 'idle' }
    | { status: 'grading' }
    | { status: 'graded'; grade: GradeData }
    | { status: 'error'; code: string }
  >({ status: 'idle' });
  const name = displayName(card);
  const mja = displayMeaningJa(card);

  async function handleGrade() {
    if (!sentence.trim()) return;
    setGradeState({ status: 'grading' });
    const result = await gradeSentence({
      userVocabId: card.id,
      sentence: sentence.trim(),
      targetTerm: name,
      meaning: mja,
    });
    if (result.ok) {
      setGradeState({ status: 'graded', grade: result.grade });
    } else {
      setGradeState({ status: 'error', code: result.error });
    }
  }

  function handleNext() {
    if (gradeState.status !== 'graded') return;
    onRate(gradeToQuality(gradeState.grade.total));
  }

  return (
    <Stack gap="md">
      <Stack gap={4}>
        <Group gap="xs">
          <Text c="dimmed" size="xs" tt="uppercase" fw={500}>
            {t('writeSentenceUsing')}
          </Text>
        </Group>
        <Title order={3} lh={1.25}>
          {name}
        </Title>
        {mja ? (
          <Text size="sm" c="dimmed">
            {mja}
          </Text>
        ) : null}
      </Stack>

      <Textarea
        placeholder={t('sentencePlaceholder')}
        value={sentence}
        onChange={(e) => setSentence(e.currentTarget.value)}
        disabled={gradeState.status !== 'idle'}
        minRows={3}
        autosize
      />

      {gradeState.status === 'idle' ? (
        <Button
          onClick={handleGrade}
          disabled={!sentence.trim()}
          leftSection={<Sparkles size={16} />}
        >
          {t('gradeWithAi')}
        </Button>
      ) : gradeState.status === 'grading' ? (
        <Group gap="xs">
          <Loader size="xs" />
          <Text size="sm" c="dimmed">
            {t('gradingInProgress')}
          </Text>
        </Group>
      ) : gradeState.status === 'error' ? (
        <Stack gap="xs">
          <Alert color="red" icon={<AlertCircle size={14} />} variant="light">
            <Text size="xs">
              {gradeState.code === 'RATE_LIMITED'
                ? t('gradeRateLimited')
                : t('gradeFailed')}
            </Text>
          </Alert>
          <Button
            onClick={() => setGradeState({ status: 'idle' })}
            variant="light"
          >
            {t('retry')}
          </Button>
        </Stack>
      ) : (
        <GradeDisplay grade={gradeState.grade} onNext={handleNext} busy={busy} />
      )}
    </Stack>
  );
}

function GradeDisplay({
  grade,
  onNext,
  busy,
}: {
  grade: GradeData;
  onNext: () => void;
  busy: boolean;
}) {
  const t = useTranslations('review');
  return (
    <Stack gap="sm">
      <Divider />
      <Group gap="md" wrap="wrap" justify="space-around">
        <ScorePill label={t('grammar')} value={grade.grammar} />
        <ScorePill label={t('meaning')} value={grade.meaning} />
        <ScorePill label={t('naturalness')} value={grade.naturalness} />
        <ScorePill label={t('total')} value={grade.total} emphasize />
      </Group>
      <Card withBorder radius="sm" p="sm">
        <Text size="sm" lh={1.6}>
          {grade.feedback_ja}
        </Text>
      </Card>
      {grade.corrected ? (
        <Stack gap={2}>
          <Text c="dimmed" size="xs" tt="uppercase" fw={500}>
            {t('corrected')}
          </Text>
          <Text size="sm" fs="italic">
            {grade.corrected}
          </Text>
        </Stack>
      ) : null}
      <Button
        rightSection={<ArrowRight size={14} />}
        onClick={onNext}
        loading={busy}
        mt="xs"
      >
        {t('next')}
      </Button>
    </Stack>
  );
}

function ScorePill({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: number;
  emphasize?: boolean;
}) {
  const color = value >= 4 ? 'teal' : value >= 3 ? 'indigo' : value >= 2 ? 'yellow' : 'red';
  return (
    <Stack gap={2} align="center">
      <Text size="xs" c="dimmed" fw={500}>
        {label}
      </Text>
      <Badge
        color={color}
        size={emphasize ? 'xl' : 'lg'}
        variant={emphasize ? 'filled' : 'light'}
      >
        {value} / 5
      </Badge>
    </Stack>
  );
}

function RateButtons({
  onRate,
  disabled,
}: {
  onRate: (quality: number) => void;
  disabled: boolean;
}) {
  const t = useTranslations('review');
  return (
    <Group grow gap="xs">
      <Button
        color="red"
        variant="light"
        onClick={() => onRate(1)}
        disabled={disabled}
      >
        {t('again')}
      </Button>
      <Button
        color="yellow"
        variant="light"
        onClick={() => onRate(3)}
        disabled={disabled}
      >
        {t('hard')}
      </Button>
      <Button
        color="indigo"
        variant="light"
        onClick={() => onRate(4)}
        disabled={disabled}
      >
        {t('good')}
      </Button>
      <Button
        color="teal"
        variant="light"
        onClick={() => onRate(5)}
        disabled={disabled}
      >
        {t('easy')}
      </Button>
    </Group>
  );
}

function SessionSummary({
  results,
  exitHref,
  locale,
}: {
  results: Result[];
  exitHref: string;
  locale: string;
}) {
  const t = useTranslations('review');
  const advanced = results.filter((r) => r.stageAfter !== r.stageBefore).length;
  const mastered = results.filter((r) => r.stageAfter === 'mastered').length;
  const lapsed = results.filter((r) => r.quality < 3).length;

  return (
    <Stack gap="lg" maw={680}>
      <Stack gap="xs" align="flex-start">
        <Group gap="xs">
          <CircleCheckBig size={20} />
          <Title order={2}>{t('summaryTitle')}</Title>
        </Group>
        <Text c="dimmed" size="sm">
          {t('summarySubtitle', { count: results.length })}
        </Text>
      </Stack>

      <Group gap="md">
        <SummaryStat label={t('summary.advanced')} value={advanced} />
        <SummaryStat label={t('summary.mastered')} value={mastered} />
        <SummaryStat label={t('summary.lapsed')} value={lapsed} />
      </Group>

      <Stack gap="xs">
        {results.map((r, i) => (
          <Paper key={i} withBorder radius="sm" p="sm">
            <Group justify="space-between" wrap="nowrap">
              <Text size="sm" fw={500} style={{ flex: 1, minWidth: 0 }} truncate>
                {displayName(r.card)}
              </Text>
              <Group gap="xs">
                <StageBadge stage={r.stageAfter} size="xs" />
                <Text size="xs" c="dimmed">
                  {r.intervalDays < 1
                    ? t('intervalMinutes', { m: Math.round(r.intervalDays * 24 * 60) })
                    : t('intervalDays', { d: Math.round(r.intervalDays) })}
                </Text>
              </Group>
            </Group>
          </Paper>
        ))}
      </Stack>

      <Button component="a" href={exitHref} variant="light">
        {t('backHome')}
      </Button>
    </Stack>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <Card withBorder radius="md" p="md">
      <Stack gap={2}>
        <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
          {label}
        </Text>
        <Text size="xl" fw={700}>
          {value}
        </Text>
      </Stack>
    </Card>
  );
}
