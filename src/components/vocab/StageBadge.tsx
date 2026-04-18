import { Badge, type BadgeProps } from '@mantine/core';
import { useTranslations } from 'next-intl';

import type { VocabStage } from '@/types/db';

const COLORS: Record<VocabStage, BadgeProps['color']> = {
  memorize: 'gray',
  recognize: 'indigo',
  produce: 'teal',
  mastered: 'yellow',
};

export function StageBadge({
  stage,
  size = 'sm',
  variant = 'light',
}: {
  stage: VocabStage;
  size?: BadgeProps['size'];
  variant?: BadgeProps['variant'];
}) {
  const t = useTranslations('vocab.stage');
  return (
    <Badge color={COLORS[stage]} variant={variant} size={size}>
      {t(stage)}
    </Badge>
  );
}
