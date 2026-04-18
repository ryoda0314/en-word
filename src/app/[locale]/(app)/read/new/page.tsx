import { Stack, Text, Title } from '@mantine/core';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { GeneratePassageForm } from '@/components/read/GeneratePassageForm';

export default async function NewPassagePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('read.generate');

  return (
    <Stack gap="lg" maw={640}>
      <Stack gap={4}>
        <Title order={2}>{t('title')}</Title>
        <Text c="dimmed" size="sm">
          {t('subtitle')}
        </Text>
      </Stack>
      <GeneratePassageForm locale={locale} />
    </Stack>
  );
}
