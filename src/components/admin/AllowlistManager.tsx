'use client';

import {
  ActionIcon,
  Alert,
  Button,
  Card,
  Group,
  Paper,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { AlertCircle, Trash2, UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';

import {
  addAllowlistEntry,
  removeAllowlistEntry,
  type AllowlistEntry,
} from '@/lib/actions/admin';

export function AllowlistManager({
  initialEntries,
}: {
  initialEntries: AllowlistEntry[];
}) {
  const t = useTranslations('admin');
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleAdd() {
    setError(null);
    if (!email.trim()) return;
    startTransition(async () => {
      const result = await addAllowlistEntry({
        email: email.trim(),
        note: note.trim() || undefined,
      });
      if (result.ok) {
        setEmail('');
        setNote('');
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  function handleRemove(target: string) {
    startTransition(async () => {
      const result = await removeAllowlistEntry(target);
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }

  return (
    <Stack gap="lg">
      <Paper withBorder radius="md" p="lg">
        <Stack gap="md">
          <Text fw={600}>{t('addTitle')}</Text>
          <TextInput
            label={t('emailLabel')}
            placeholder="someone@example.com"
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
            type="email"
          />
          <TextInput
            label={t('noteLabel')}
            description={t('noteDesc')}
            placeholder={t('notePlaceholder')}
            value={note}
            onChange={(e) => setNote(e.currentTarget.value)}
          />
          <Group>
            <Button
              leftSection={<UserPlus size={14} />}
              onClick={handleAdd}
              loading={pending}
              disabled={!email.trim()}
            >
              {t('add')}
            </Button>
          </Group>
          {error ? (
            <Alert color="red" icon={<AlertCircle size={14} />} variant="light">
              {error}
            </Alert>
          ) : null}
        </Stack>
      </Paper>

      <Card withBorder radius="md" p="lg">
        <Stack gap="md">
          <Group justify="space-between">
            <Text fw={600}>{t('currentTitle')}</Text>
            <Text c="dimmed" size="xs">
              {t('count', { count: initialEntries.length })}
            </Text>
          </Group>

          {initialEntries.length === 0 ? (
            <Text c="dimmed" size="sm">
              {t('empty')}
            </Text>
          ) : (
            <Table verticalSpacing="xs" striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('emailLabel')}</Table.Th>
                  <Table.Th>{t('noteLabel')}</Table.Th>
                  <Table.Th>{t('addedAt')}</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {initialEntries.map((e) => (
                  <Table.Tr key={e.email}>
                    <Table.Td style={{ wordBreak: 'break-all' }}>
                      {e.email}
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed">
                        {e.note ?? ''}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed">
                        {new Date(e.created_at).toLocaleDateString()}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => handleRemove(e.email)}
                        disabled={pending}
                        aria-label={t('remove')}
                      >
                        <Trash2 size={14} />
                      </ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Stack>
      </Card>
    </Stack>
  );
}
