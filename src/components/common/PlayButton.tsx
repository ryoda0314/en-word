'use client';

import { ActionIcon, Tooltip } from '@mantine/core';
import { Loader2, Volume2, VolumeX } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';

import { generateSpeech } from '@/lib/actions/speech';

type Props = {
  text: string;
  slow?: boolean;
  size?: number;
  variant?: 'subtle' | 'light' | 'default';
  ariaLabel?: string;
};

type State = 'idle' | 'loading' | 'playing' | 'error' | 'unavailable';

const urlCache = new Map<string, string>();

function cacheKey(text: string, slow: boolean) {
  return `${slow ? 'slow' : 'norm'}::${text}`;
}

export function PlayButton({
  text,
  slow = false,
  size = 18,
  variant = 'subtle',
  ariaLabel,
}: Props) {
  const t = useTranslations('audio');
  const [state, setState] = useState<State>('idle');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  async function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (state === 'loading' || state === 'playing') return;

    let url = urlCache.get(cacheKey(text, slow));
    if (!url) {
      setState('loading');
      const result = await generateSpeech({ text, slow });
      if (!result.ok) {
        if (result.error === 'NOT_CONFIGURED') setState('unavailable');
        else setState('error');
        setTimeout(() => setState('idle'), 2400);
        return;
      }
      url = result.audioUrl;
      urlCache.set(cacheKey(text, slow), url);
    }

    setState('playing');
    try {
      const audio = new Audio(url);
      audioRef.current = audio;
      await audio.play();
      await new Promise<void>((resolve) => {
        audio.addEventListener('ended', () => resolve(), { once: true });
        audio.addEventListener('error', () => resolve(), { once: true });
      });
    } catch (err) {
      console.error('Audio playback failed', err);
    }
    setState('idle');
  }

  const label =
    state === 'unavailable'
      ? t('unavailable')
      : state === 'error'
        ? t('failed')
        : state === 'playing'
          ? t('playing')
          : t('play');

  const icon =
    state === 'loading' ? (
      <Loader2 size={size} className="mantine-rotating" />
    ) : state === 'unavailable' || state === 'error' ? (
      <VolumeX size={size} />
    ) : (
      <Volume2 size={size} />
    );

  return (
    <Tooltip label={label} withArrow>
      <ActionIcon
        variant={variant}
        color={state === 'error' || state === 'unavailable' ? 'red' : 'indigo'}
        onClick={handleClick}
        disabled={state === 'loading' || state === 'unavailable'}
        aria-label={ariaLabel ?? label}
      >
        {icon}
      </ActionIcon>
    </Tooltip>
  );
}
