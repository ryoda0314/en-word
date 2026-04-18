'use client';

import { Tabs } from '@mantine/core';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';

import type { VocabStage } from '@/types/db';

type Stage = VocabStage | 'all';

type Stats = {
  total_count: number;
  memorize_count: number;
  recognize_count: number;
  produce_count: number;
  mastered_count: number;
};

export function VocabFilters({
  currentStage,
  stats,
}: {
  currentStage: Stage;
  stats: Stats;
}) {
  const t = useTranslations('vocab');
  const tStage = useTranslations('vocab.stage');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function setStage(value: string | null) {
    const stage = (value ?? 'all') as Stage;
    const params = new URLSearchParams(searchParams);
    if (stage === 'all') params.delete('stage');
    else params.set('stage', stage);
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  return (
    <Tabs value={currentStage} onChange={setStage} variant="outline">
      <Tabs.List>
        <Tabs.Tab value="all">
          {t('all')} ({stats.total_count})
        </Tabs.Tab>
        <Tabs.Tab value="memorize">
          {tStage('memorize')} ({stats.memorize_count})
        </Tabs.Tab>
        <Tabs.Tab value="recognize">
          {tStage('recognize')} ({stats.recognize_count})
        </Tabs.Tab>
        <Tabs.Tab value="produce">
          {tStage('produce')} ({stats.produce_count})
        </Tabs.Tab>
        <Tabs.Tab value="mastered">
          {tStage('mastered')} ({stats.mastered_count})
        </Tabs.Tab>
      </Tabs.List>
    </Tabs>
  );
}
