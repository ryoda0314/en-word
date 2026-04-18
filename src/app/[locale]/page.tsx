import { Container, Group, Stack, Text, Title } from '@mantine/core';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { LinkButton } from '@/components/common/LinkButton';

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('home');
  const tApp = await getTranslations('app');

  return (
    <Container size="md" py={96}>
      <Stack gap="lg" align="flex-start">
        <Text c="dimmed" size="sm" tt="uppercase" fw={500}>
          {tApp('name')} — {tApp('tagline')}
        </Text>
        <Title order={1} size={40} lh={1.3}>
          {t('heroTitle')}
        </Title>
        <Text size="lg" c="dimmed" maw={640} lh={1.7}>
          {t('heroBody')}
        </Text>
        <Group gap="sm" mt="md">
          <LinkButton href="/dashboard" size="md">
            {t('ctaStart')}
          </LinkButton>
          <LinkButton href="/auth/login" size="md" variant="subtle">
            {t('ctaLogin')}
          </LinkButton>
        </Group>
      </Stack>
    </Container>
  );
}
