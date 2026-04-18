import {
  Badge,
  Group,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { LinkCard } from '@/components/common/LinkCard';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function ReadListPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('read');

  const supabase = await createSupabaseServerClient();
  const { data: passages } = await supabase
    .from('passages')
    .select('id, slug, title, level, part, word_count')
    .order('created_at', { ascending: true });

  return (
    <Stack gap="lg">
      <Stack gap={4}>
        <Title order={2}>{t('title')}</Title>
        <Text c="dimmed" size="sm">
          {t('subtitle')}
        </Text>
      </Stack>

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        {(passages ?? []).map((p) => (
          <LinkCard
            key={p.id}
            href={`/read/${p.slug}`}
            withBorder
            radius="md"
            p="lg"
          >
            <Stack gap="xs">
              <Group gap={6} wrap="wrap">
                {p.part ? (
                  <Badge variant="light" size="sm" color="indigo">
                    {p.part}
                  </Badge>
                ) : null}
                {p.level ? (
                  <Badge variant="default" size="sm">
                    {p.level}
                  </Badge>
                ) : null}
              </Group>
              <Text fw={600} fz="lg" lh={1.3}>
                {p.title}
              </Text>
              <Text c="dimmed" size="xs">
                {t('wordCount', { count: p.word_count ?? 0 })}
              </Text>
            </Stack>
          </LinkCard>
        ))}
      </SimpleGrid>
    </Stack>
  );
}
