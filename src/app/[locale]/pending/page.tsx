import { Card, Center, Container, Stack, Text, Title } from '@mantine/core';
import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { PendingActions } from '@/components/auth/PendingActions';
import { isApproved } from '@/lib/auth/approval';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function PendingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('pending');

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/auth/login`);

  const approved = await isApproved(supabase);
  if (approved) redirect(`/${locale}/dashboard`);

  return (
    <Center mih="100svh" px="md">
      <Container size={520} w="100%">
        <Stack gap="lg">
          <Stack gap="xs" align="center">
            <Title order={2} ta="center">
              {t('title')}
            </Title>
            <Text c="dimmed" size="sm" ta="center">
              {t('subtitle')}
            </Text>
          </Stack>

          <Card withBorder radius="md" p="lg">
            <Stack gap="md">
              <Stack gap={2}>
                <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
                  {t('signedInAs')}
                </Text>
                <Text>{user.email}</Text>
              </Stack>
              <Text size="sm" c="dimmed" lh={1.7}>
                {t('howToRequest')}
              </Text>
              <PendingActions locale={locale} />
            </Stack>
          </Card>
        </Stack>
      </Container>
    </Center>
  );
}
