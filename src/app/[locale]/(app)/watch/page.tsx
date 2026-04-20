import {
  Badge,
  Card,
  Container,
  Group,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Link } from '@/i18n/navigation';
import { ImportForm } from '@/components/watch/ImportForm';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function WatchListPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('watch');

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('videos')
    .select('id, youtube_id, title, lang, created_at')
    .order('created_at', { ascending: false })
    .limit(12);

  const videos = data ?? [];

  return (
    <Container size="md" px={0}>
      <Stack gap="xl">
        <Stack gap={4}>
          <Title order={2}>{t('title')}</Title>
          <Text c="dimmed" size="sm">
            {t('subtitle')}
          </Text>
        </Stack>

        <Card withBorder p="lg" radius="md">
          <Stack gap="sm">
            <Text fw={600} size="sm">
              {t('importHeading')}
            </Text>
            <Text c="dimmed" size="xs">
              {t('importHint')}
            </Text>
            <ImportForm />
          </Stack>
        </Card>

        <Stack gap="sm">
          <Text fw={600} size="sm">
            {t('recentHeading')}
          </Text>
          {videos.length === 0 ? (
            <Text c="dimmed" size="sm">
              {t('recentEmpty')}
            </Text>
          ) : (
            <Stack gap="xs">
              {videos.map((v) => (
                <Link
                  key={v.id}
                  href={`/watch/${v.youtube_id}`}
                  style={{ textDecoration: 'none' }}
                >
                  <Card withBorder p="md" radius="md">
                    <Group justify="space-between" wrap="nowrap">
                      <Stack gap={4} style={{ minWidth: 0 }}>
                        <Text fw={600} size="sm" truncate>
                          {v.title ?? v.youtube_id}
                        </Text>
                        <Text c="dimmed" size="xs" ff="monospace" truncate>
                          {v.youtube_id}
                        </Text>
                      </Stack>
                      {v.lang ? (
                        <Badge size="xs" variant="default">
                          {v.lang}
                        </Badge>
                      ) : null}
                    </Group>
                  </Card>
                </Link>
              ))}
            </Stack>
          )}
        </Stack>
      </Stack>
    </Container>
  );
}
