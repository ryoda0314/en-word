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
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import {
  AlertCircle,
  BookPlus,
  Sparkles,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';

import { type GlossData, lookupGloss } from '@/lib/actions/gloss';
import { addToVocab } from '@/lib/actions/vocab';

type AiState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; data: GlossData }
  | { status: 'error'; code: string };

export function NewVocabForm({ locale }: { locale: string }) {
  const t = useTranslations('vocab.new');
  const router = useRouter();
  const [term, setTerm] = useState('');
  const [meaningJa, setMeaningJa] = useState('');
  const [example, setExample] = useState('');
  const [ai, setAi] = useState<AiState>({ status: 'idle' });
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function resetAi() {
    setAi({ status: 'idle' });
  }

  function detectKind(text: string): 'word' | 'phrase' {
    return text.trim().split(/\s+/).length > 1 ? 'phrase' : 'word';
  }

  async function handleAiLookup() {
    const value = term.trim();
    if (!value) return;
    setAi({ status: 'loading' });
    setSaveError(null);
    const kind = detectKind(value);
    const result = await lookupGloss({
      term: value,
      kind,
      context: example.trim() || undefined,
    });
    if (result.ok) {
      setAi({ status: 'ready', data: result.gloss });
      if (!meaningJa.trim()) setMeaningJa(result.gloss.meaning_ja);
      if (!example.trim() && result.gloss.example_en) {
        setExample(result.gloss.example_en);
      }
    } else {
      setAi({
        status: 'error',
        code: result.error,
      });
    }
  }

  async function handleSave() {
    const value = term.trim();
    if (!value) return;
    setSaveError(null);

    startTransition(async () => {
      let result;
      if (ai.status === 'ready' && ai.data.wordId) {
        result = await addToVocab({
          wordId: ai.data.wordId,
          contextSentence: example.trim() || undefined,
        });
      } else if (ai.status === 'ready' && ai.data.idiomId) {
        result = await addToVocab({
          idiomId: ai.data.idiomId,
          contextSentence: example.trim() || undefined,
        });
      } else {
        if (!meaningJa.trim()) {
          setSaveError(t('needMeaning'));
          return;
        }
        result = await addToVocab({
          customTerm: value,
          customMeaningJa: meaningJa.trim(),
          contextSentence: example.trim() || undefined,
        });
      }

      if (result.ok) {
        router.push(`/${locale}/vocab/${result.id}`);
      } else {
        setSaveError(t('saveFailed'));
      }
    });
  }

  const aiErrorMessage =
    ai.status === 'error'
      ? ai.code === 'RATE_LIMITED'
        ? t('aiRate')
        : ai.code === 'UNAUTHENTICATED'
          ? t('notSignedIn')
          : t('aiFailed')
      : null;

  return (
    <Paper withBorder radius="md" p="lg">
      <Stack gap="md">
        <TextInput
          label={t('termLabel')}
          description={t('termDesc')}
          placeholder={t('termPlaceholder')}
          value={term}
          onChange={(e) => {
            setTerm(e.currentTarget.value);
            if (ai.status !== 'idle') resetAi();
          }}
          autoFocus
        />

        <Textarea
          label={t('meaningLabel')}
          description={t('meaningDesc')}
          placeholder={t('meaningPlaceholder')}
          value={meaningJa}
          onChange={(e) => setMeaningJa(e.currentTarget.value)}
          autosize
          minRows={2}
          maxRows={5}
        />

        <Textarea
          label={t('exampleLabel')}
          description={t('exampleDesc')}
          placeholder={t('examplePlaceholder')}
          value={example}
          onChange={(e) => setExample(e.currentTarget.value)}
          autosize
          minRows={2}
          maxRows={4}
        />

        <Group gap="xs" wrap="wrap">
          <Button
            variant="light"
            leftSection={<Sparkles size={14} />}
            onClick={handleAiLookup}
            loading={ai.status === 'loading'}
            disabled={!term.trim() || pending}
          >
            {t('aiLookup')}
          </Button>
          <Button
            leftSection={<BookPlus size={14} />}
            onClick={handleSave}
            loading={pending}
            disabled={!term.trim() || ai.status === 'loading'}
          >
            {t('save')}
          </Button>
        </Group>

        {aiErrorMessage ? (
          <Alert color="red" icon={<AlertCircle size={14} />} variant="light">
            <Text size="sm">{aiErrorMessage}</Text>
          </Alert>
        ) : null}

        {saveError ? (
          <Alert color="red" icon={<AlertCircle size={14} />} variant="light">
            <Text size="sm">{saveError}</Text>
          </Alert>
        ) : null}

        {ai.status === 'loading' ? (
          <Group gap="xs">
            <Loader size="xs" />
            <Text size="xs" c="dimmed">
              {t('aiLoading')}
            </Text>
          </Group>
        ) : null}

        {ai.status === 'ready' ? <AiPreview data={ai.data} /> : null}
      </Stack>
    </Paper>
  );
}

function AiPreview({ data }: { data: GlossData }) {
  const t = useTranslations('vocab.new');
  return (
    <Card withBorder radius="sm" p="md">
      <Stack gap="xs">
        <Group gap="xs" wrap="wrap">
          <Badge
            color={data.source === 'dict' ? 'gray' : 'grape'}
            variant="light"
            size="xs"
            leftSection={
              data.source === 'ai' ? <Sparkles size={10} /> : undefined
            }
          >
            {data.source === 'dict' ? t('fromDict') : t('aiBadge')}
          </Badge>
          <Text fw={700} size="md">
            {data.headword}
          </Text>
          {data.pos ? (
            <Badge size="xs" variant="default">
              {data.pos}
            </Badge>
          ) : null}
          {data.ipa ? (
            <Text size="xs" c="dimmed" ff="monospace">
              {data.ipa}
            </Text>
          ) : null}
        </Group>
        {data.meaning_ja ? <Text size="sm">{data.meaning_ja}</Text> : null}
        {data.meaning_en ? (
          <Text size="xs" c="dimmed" lh={1.5}>
            {data.meaning_en}
          </Text>
        ) : null}
        {data.example_en ? (
          <>
            <Divider my={4} />
            <Text size="xs" fs="italic">
              {data.example_en}
            </Text>
            {data.example_ja ? (
              <Text size="xs" c="dimmed">
                {data.example_ja}
              </Text>
            ) : null}
          </>
        ) : null}
      </Stack>
    </Card>
  );
}
