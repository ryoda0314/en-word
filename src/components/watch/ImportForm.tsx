'use client';

import { Alert, Button, Stack, TextInput } from '@mantine/core';
import { AlertCircle, Video } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';

import { useRouter } from '@/i18n/navigation';
import {
  importYoutubeVideo,
  type ImportYoutubeResult,
} from '@/lib/actions/youtube';

export function ImportForm() {
  const t = useTranslations('watch');
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = url.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const result: ImportYoutubeResult = await importYoutubeVideo({ url: trimmed });
      if (result.ok) {
        router.push(`/watch/${result.video.youtube_id}`);
      } else {
        setError(errorMessage(t, result.error));
      }
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="sm">
        <TextInput
          value={url}
          onChange={(e) => setUrl(e.currentTarget.value)}
          placeholder={t('urlPlaceholder')}
          disabled={pending}
          leftSection={<Video size={16} />}
          size="md"
        />
        <Button type="submit" loading={pending} disabled={url.trim().length === 0}>
          {t('import')}
        </Button>
        {error ? (
          <Alert color="red" icon={<AlertCircle size={16} />} variant="light">
            {error}
          </Alert>
        ) : null}
      </Stack>
    </form>
  );
}

function errorMessage(t: ReturnType<typeof useTranslations>, code: string) {
  switch (code) {
    case 'INVALID_URL':
      return t('errInvalid');
    case 'NO_TRANSCRIPT':
      return t('errNoTranscript');
    case 'NOT_FOUND':
      return t('errNotFound');
    case 'YOUTUBE_THROTTLED':
      return t('errThrottled');
    case 'RATE_LIMITED':
      return t('errRate');
    case 'SAVE_FAILED':
      return t('errSave');
    case 'UNAUTHENTICATED':
      return t('errAuth');
    case 'NOT_APPROVED':
      return t('errApproval');
    default:
      return t('errGeneric');
  }
}
