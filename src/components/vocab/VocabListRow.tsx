import { Badge, Group, Stack, Text } from '@mantine/core';

import { LinkCard } from '@/components/common/LinkCard';
import { StageBadge } from '@/components/vocab/StageBadge';
import type { VocabStage } from '@/types/db';

export type VocabListItem = {
  id: string;
  stage: VocabStage;
  next_review_at: string;
  custom_term: string | null;
  custom_meaning_ja: string | null;
  context_sentence: string | null;
  word: { lemma: string; meaning_ja: string | null; pos: string | null } | null;
  idiom: { phrase: string; meaning_ja: string | null } | null;
};

function displayName(item: VocabListItem): string {
  return item.word?.lemma ?? item.idiom?.phrase ?? item.custom_term ?? '';
}

function displayMeaning(item: VocabListItem): string {
  return (
    item.word?.meaning_ja ??
    item.idiom?.meaning_ja ??
    item.custom_meaning_ja ??
    ''
  );
}

function kindLabel(item: VocabListItem) {
  if (item.idiom) return 'idiom';
  if (item.custom_term) return 'custom';
  return 'word';
}

export function VocabListRow({
  item,
  dueLabel,
  customLabel,
  phraseLabel,
}: {
  item: VocabListItem;
  dueLabel: string;
  customLabel: string;
  phraseLabel: string;
}) {
  const isDue = new Date(item.next_review_at).getTime() <= Date.now();
  const kind = kindLabel(item);

  return (
    <LinkCard href={`/vocab/${item.id}`} withBorder radius="md" p="md">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Stack gap={4} style={{ minWidth: 0, flex: 1 }}>
          <Group gap={6} wrap="wrap">
            <Text fw={600} size="md" style={{ wordBreak: 'break-word' }}>
              {displayName(item)}
            </Text>
            {kind === 'idiom' ? (
              <Badge size="xs" variant="light" color="indigo">
                {phraseLabel}
              </Badge>
            ) : null}
            {kind === 'custom' ? (
              <Badge size="xs" variant="light" color="grape">
                {customLabel}
              </Badge>
            ) : null}
            {item.word?.pos ? (
              <Badge size="xs" variant="default">
                {item.word.pos}
              </Badge>
            ) : null}
          </Group>
          {displayMeaning(item) ? (
            <Text size="sm" c="dimmed" lineClamp={2}>
              {displayMeaning(item)}
            </Text>
          ) : null}
        </Stack>
        <Stack gap={6} align="flex-end">
          <StageBadge stage={item.stage} />
          {isDue && item.stage !== 'mastered' ? (
            <Badge color="red" variant="light" size="xs">
              {dueLabel}
            </Badge>
          ) : null}
        </Stack>
      </Group>
    </LinkCard>
  );
}
