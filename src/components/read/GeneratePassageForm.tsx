'use client';

import {
  Alert,
  Button,
  LoadingOverlay,
  Paper,
  Select,
  Stack,
  Textarea,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { AlertCircle, Sparkles } from 'lucide-react';
import { zodResolver } from 'mantine-form-zod-resolver';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { z } from 'zod';

import {
  generatePassage,
  PASSAGE_LENGTH_OPTIONS,
  PASSAGE_LEVEL_OPTIONS,
  PASSAGE_PART_OPTIONS,
} from '@/lib/actions/passage';

const schema = z.object({
  topic: z.string().min(3).max(300),
  part: z.enum(PASSAGE_PART_OPTIONS),
  level: z.enum(PASSAGE_LEVEL_OPTIONS),
  length: z.enum(PASSAGE_LENGTH_OPTIONS),
  notes: z.string().max(500).optional(),
});

export function GeneratePassageForm({ locale }: { locale: string }) {
  const t = useTranslations('read.generate');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const form = useForm({
    mode: 'uncontrolled',
    initialValues: {
      topic: '',
      part: 'TOEFL Reading' as (typeof PASSAGE_PART_OPTIONS)[number],
      level: 'B2' as (typeof PASSAGE_LEVEL_OPTIONS)[number],
      length: 'medium' as (typeof PASSAGE_LENGTH_OPTIONS)[number],
      notes: '',
    },
    validate: zodResolver(schema),
  });

  function handleSubmit(values: z.input<typeof schema>) {
    setError(null);
    startTransition(async () => {
      const result = await generatePassage(values);
      if (result.ok) {
        router.push(`/${locale}/read/${result.slug}`);
      } else {
        setError(
          result.error === 'RATE_LIMITED'
            ? t('errRate')
            : result.error === 'AI_FAILED'
              ? t('errAi')
              : result.error === 'UNAUTHENTICATED'
                ? t('errAuth')
                : t('errGeneric'),
        );
      }
    });
  }

  return (
    <Paper withBorder radius="md" p="lg" pos="relative">
      <LoadingOverlay
        visible={pending}
        overlayProps={{ blur: 2 }}
        loaderProps={{ children: t('generating') }}
      />
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <Textarea
            label={t('topicLabel')}
            description={t('topicDesc')}
            placeholder={t('topicPlaceholder')}
            autosize
            minRows={2}
            maxRows={5}
            key={form.key('topic')}
            {...form.getInputProps('topic')}
          />

          <Select
            label={t('partLabel')}
            description={t('partDesc')}
            allowDeselect={false}
            data={[
              { value: 'TOEFL Reading', label: 'TOEFL Reading' },
              { value: 'TOEIC Part 6', label: 'TOEIC Part 6' },
              { value: 'TOEIC Part 7', label: 'TOEIC Part 7' },
              { value: 'General', label: t('partGeneral') },
            ]}
            key={form.key('part')}
            {...form.getInputProps('part')}
          />

          <Select
            label={t('levelLabel')}
            description={t('levelDesc')}
            allowDeselect={false}
            data={[
              { value: 'B1', label: `B1 ${t('levelB1')}` },
              { value: 'B2', label: `B2 ${t('levelB2')}` },
              { value: 'C1', label: `C1 ${t('levelC1')}` },
              { value: 'C2', label: `C2 ${t('levelC2')}` },
            ]}
            key={form.key('level')}
            {...form.getInputProps('level')}
          />

          <Select
            label={t('lengthLabel')}
            allowDeselect={false}
            data={[
              { value: 'short', label: t('lengthShort') },
              { value: 'medium', label: t('lengthMedium') },
              { value: 'long', label: t('lengthLong') },
            ]}
            key={form.key('length')}
            {...form.getInputProps('length')}
          />

          <Textarea
            label={t('notesLabel')}
            description={t('notesDesc')}
            placeholder={t('notesPlaceholder')}
            autosize
            minRows={2}
            maxRows={4}
            key={form.key('notes')}
            {...form.getInputProps('notes')}
          />

          {error ? (
            <Alert color="red" icon={<AlertCircle size={16} />} variant="light">
              {error}
            </Alert>
          ) : null}

          <Button
            type="submit"
            leftSection={<Sparkles size={16} />}
            loading={pending}
            size="md"
          >
            {t('submit')}
          </Button>
        </Stack>
      </form>
    </Paper>
  );
}
