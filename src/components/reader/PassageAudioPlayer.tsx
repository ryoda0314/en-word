'use client';

import {
  ActionIcon,
  Alert,
  Group,
  Paper,
  SegmentedControl,
  Slider,
  Text,
  Tooltip,
} from '@mantine/core';
import { AlertCircle, Headphones, Loader2, Pause, Play } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import { generateSpeech } from '@/lib/actions/speech';
import type { Sentence } from '@/lib/text/sentences';

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

type Status = 'idle' | 'loading' | 'ready' | 'error' | 'unavailable';

type Props = {
  text: string;
  sentences?: Sentence[];
  onRangeChange?: (range: { start: number; end: number } | null) => void;
};

export function PassageAudioPlayer({ text, sentences, onRangeChange }: Props) {
  const t = useTranslations('passageAudio');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timedSentencesRef = useRef<Sentence[]>([]);
  const currentSentenceIdxRef = useRef<number>(-1);

  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState<string>('1');

  useEffect(() => {
    return () => {
      const a = audioRef.current;
      if (a) {
        a.pause();
        a.src = '';
      }
      onRangeChange?.(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function computeTimings(totalSec: number) {
    if (!sentences || sentences.length === 0) {
      timedSentencesRef.current = [];
      return;
    }
    const totalChars = sentences[sentences.length - 1].charEnd;
    timedSentencesRef.current = sentences.map((s) => ({
      ...s,
      startSec: (s.charStart / totalChars) * totalSec,
      endSec: (s.charEnd / totalChars) * totalSec,
    }));
  }

  function updateCurrentSentence(timeSec: number) {
    const list = timedSentencesRef.current;
    if (list.length === 0) {
      onRangeChange?.(null);
      return;
    }
    let idx = list.findIndex(
      (s) => timeSec >= (s.startSec ?? 0) && timeSec < (s.endSec ?? 0),
    );
    if (idx === -1 && timeSec >= (list[list.length - 1].endSec ?? 0)) {
      idx = list.length - 1;
    }
    if (idx !== currentSentenceIdxRef.current) {
      currentSentenceIdxRef.current = idx;
      if (idx >= 0) {
        const s = list[idx];
        onRangeChange?.({ start: s.charStart, end: s.charEnd });
      } else {
        onRangeChange?.(null);
      }
    }
  }

  async function ensureLoaded(): Promise<HTMLAudioElement | null> {
    if (audioRef.current) return audioRef.current;

    setStatus('loading');
    setError(null);
    const result = await generateSpeech({ text });
    if (!result.ok) {
      if (result.error === 'NOT_CONFIGURED') {
        setStatus('unavailable');
        setError(t('notConfigured'));
      } else if (result.error === 'RATE_LIMITED') {
        setStatus('error');
        setError(t('rateLimited'));
      } else {
        setStatus('error');
        setError(t('failed'));
      }
      return null;
    }

    const audio = new Audio(result.audioUrl);
    audio.preload = 'auto';
    audio.playbackRate = Number(rate);

    audio.addEventListener('loadedmetadata', () => {
      if (Number.isFinite(audio.duration)) {
        setDuration(audio.duration);
        computeTimings(audio.duration);
      }
    });
    audio.addEventListener('durationchange', () => {
      if (Number.isFinite(audio.duration)) {
        setDuration(audio.duration);
        computeTimings(audio.duration);
      }
    });
    audio.addEventListener('timeupdate', () => {
      setCurrentTime(audio.currentTime);
      updateCurrentSentence(audio.currentTime);
    });
    audio.addEventListener('ended', () => {
      setPlaying(false);
      currentSentenceIdxRef.current = -1;
      onRangeChange?.(null);
    });
    audio.addEventListener('pause', () => setPlaying(false));
    audio.addEventListener('play', () => setPlaying(true));

    if (audio.readyState < 1) {
      await new Promise<void>((resolve) => {
        const done = () => resolve();
        audio.addEventListener('loadedmetadata', done, { once: true });
        audio.addEventListener('error', done, { once: true });
        setTimeout(done, 15000);
      });
    }

    audioRef.current = audio;
    setStatus('ready');
    return audio;
  }

  async function togglePlay() {
    const audio = await ensureLoaded();
    if (!audio) return;
    if (audio.paused || audio.ended) {
      if (audio.ended) audio.currentTime = 0;
      try {
        await audio.play();
      } catch (err) {
        console.error('play failed', err);
        setStatus('error');
        setError(t('failed'));
      }
    } else {
      audio.pause();
    }
  }

  function handleSeek(v: number) {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(duration) || duration <= 0) return;
    audio.currentTime = v;
    setCurrentTime(v);
    updateCurrentSentence(v);
  }

  function changeRate(v: string) {
    setRate(v);
    if (audioRef.current) audioRef.current.playbackRate = Number(v);
  }

  const isBusy = status === 'loading';
  const isUnavailable = status === 'unavailable';

  return (
    <Paper withBorder radius="md" p={{ base: 'sm', md: 'md' }}>
      <Group gap="md" wrap="nowrap" align="center">
        <Tooltip
          label={
            isUnavailable
              ? t('notConfigured')
              : playing
                ? t('pause')
                : t('play')
          }
          withArrow
        >
          <ActionIcon
            size="xl"
            radius="xl"
            variant={playing ? 'filled' : 'light'}
            color="indigo"
            onClick={togglePlay}
            disabled={isUnavailable}
            aria-label={playing ? t('pause') : t('play')}
          >
            {isBusy ? (
              <Loader2 size={20} className="mantine-rotating" />
            ) : playing ? (
              <Pause size={20} />
            ) : status === 'idle' && !audioRef.current ? (
              <Headphones size={20} />
            ) : (
              <Play size={20} />
            )}
          </ActionIcon>
        </Tooltip>

        <Slider
          flex={1}
          color="indigo"
          size="sm"
          value={currentTime}
          max={duration > 0 ? duration : 1}
          min={0}
          step={0.1}
          onChange={handleSeek}
          disabled={status !== 'ready' || duration <= 0}
          label={(v) => formatTime(v)}
          labelAlwaysOn={false}
        />

        <Text
          size="xs"
          c="dimmed"
          ff="monospace"
          style={{ whiteSpace: 'nowrap', minWidth: 80, textAlign: 'right' }}
        >
          {formatTime(currentTime)} / {formatTime(duration)}
        </Text>

        <SegmentedControl
          size="xs"
          value={rate}
          onChange={changeRate}
          data={['0.75', '1', '1.25', '1.5']}
          disabled={status !== 'ready'}
          visibleFrom="sm"
        />
      </Group>

      {error ? (
        <Alert
          color={isUnavailable ? 'gray' : 'red'}
          variant="light"
          icon={<AlertCircle size={14} />}
          mt="xs"
          p="xs"
        >
          <Text size="xs">{error}</Text>
        </Alert>
      ) : status === 'idle' ? (
        <Text c="dimmed" size="xs" mt={6}>
          {t('hint')}
        </Text>
      ) : null}
    </Paper>
  );
}
