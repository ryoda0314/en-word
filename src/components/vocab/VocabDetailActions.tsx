'use client';

import {
  ActionIcon,
  Button,
  Group,
  Menu,
  Modal,
  Stack,
  Text,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { MoreHorizontal, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';

import { deleteVocab } from '@/lib/actions/vocab';

export function VocabDetailActions({
  id,
  locale,
  displayName,
}: {
  id: string;
  locale: string;
  displayName: string;
}) {
  const t = useTranslations('vocab');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmOpen, confirm] = useDisclosure(false);

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteVocab(id);
      if (result.ok) {
        confirm.close();
        router.push(`/${locale}/vocab`);
      }
    });
  }

  return (
    <>
      <Group gap="xs">
        <Menu position="bottom-end" withinPortal>
          <Menu.Target>
            <ActionIcon variant="subtle" size="md" aria-label="More">
              <MoreHorizontal size={18} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              color="red"
              leftSection={<Trash2 size={14} />}
              onClick={confirm.open}
            >
              {t('delete')}
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>

      <Modal
        opened={confirmOpen}
        onClose={confirm.close}
        title={t('confirmDeleteTitle')}
        size="sm"
        centered
      >
        <Stack gap="md">
          <Text size="sm">{t('confirmDeleteBody', { name: displayName })}</Text>
          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={confirm.close} disabled={pending}>
              {t('cancel')}
            </Button>
            <Button color="red" onClick={handleDelete} loading={pending}>
              {t('delete')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
