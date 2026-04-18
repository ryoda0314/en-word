import { Center, Container, Paper, Stack, Text, Title } from '@mantine/core';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { LoginForm } from './LoginForm';

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { error, next } = await searchParams;
  const t = await getTranslations('auth');

  return (
    <Center mih="100svh" px="md">
      <Container size={420} w="100%">
        <Stack gap="xl">
          <Stack gap={4} align="center">
            <Title order={2}>{t('title')}</Title>
            <Text c="dimmed" size="sm">
              {t('subtitle')}
            </Text>
          </Stack>
          <Paper withBorder radius="md" p="xl">
            <LoginForm locale={locale} next={next} showError={error === 'auth'} />
          </Paper>
        </Stack>
      </Container>
    </Center>
  );
}
