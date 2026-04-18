import { Stack, Text, Title } from '@mantine/core';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { NewVocabForm } from '@/components/vocab/NewVocabForm';

export default async function NewVocabPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('vocab.new');

  return (
    <Stack gap="lg" maw={640}>
      <Stack gap={4}>
        <Title order={2}>{t('title')}</Title>
        <Text c="dimmed" size="sm">
          {t('subtitle')}
        </Text>
      </Stack>
      <NewVocabForm locale={locale} />
    </Stack>
  );
}
