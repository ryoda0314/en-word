'use client';

import { Button, Group } from '@mantine/core';
import { LogOut, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';

import { signOutAction } from '@/lib/actions/auth';

export function PendingActions({ locale }: { locale: string }) {
  const t = useTranslations('pending');
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleRefresh() {
    startTransition(() => {
      router.refresh();
    });
  }

  async function handleSignOut() {
    await signOutAction();
    window.location.assign(`/${locale}`);
  }

  return (
    <Group gap="xs">
      <Button
        variant="light"
        leftSection={<RefreshCw size={14} />}
        onClick={handleRefresh}
        loading={pending}
      >
        {t('recheck')}
      </Button>
      <Button
        variant="subtle"
        color="red"
        leftSection={<LogOut size={14} />}
        onClick={handleSignOut}
      >
        {t('signOut')}
      </Button>
    </Group>
  );
}
