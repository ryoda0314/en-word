'use client';

import { Grid } from '@mantine/core';
import { useCallback, useEffect, useRef, useState } from 'react';

import { SubtitleList, type TokenizedCue } from './SubtitleList';
import {
  type PlayerHandle,
  YoutubeIFramePlayer,
} from './YoutubeIFramePlayer';
import type { IdiomRow, WordRow } from '@/types/db';

type Props = {
  videoId: string;
  youtubeId: string;
  cues: TokenizedCue[];
  wordsDict: Record<string, WordRow>;
  idiomsDict: Record<string, IdiomRow>;
  savedWordIds: string[];
  savedIdiomIds: string[];
  savedCustomTerms: string[];
};

const POS_SAVE_INTERVAL_MS = 5000;

export function WatchView({
  videoId,
  youtubeId,
  cues,
  wordsDict,
  idiomsDict,
  savedWordIds,
  savedIdiomIds,
  savedCustomTerms,
}: Props) {
  const [currentMs, setCurrentMs] = useState(0);
  const [savedWords, setSavedWords] = useState(() => new Set(savedWordIds));
  const [savedIdioms, setSavedIdioms] = useState(() => new Set(savedIdiomIds));
  const [savedCustoms, setSavedCustoms] = useState(
    () => new Set(savedCustomTerms.map((s) => s.toLowerCase())),
  );
  const playerRef = useRef<PlayerHandle | null>(null);
  const lastSavedPosRef = useRef<number>(0);
  const positionKey = `watch:${youtubeId}:pos`;

  const handleTime = useCallback(
    (ms: number) => {
      setCurrentMs(ms);
      // Persist position at most every POS_SAVE_INTERVAL_MS to avoid spamming
      // localStorage on every tick.
      if (ms - lastSavedPosRef.current >= POS_SAVE_INTERVAL_MS) {
        lastSavedPosRef.current = ms;
        try {
          window.localStorage.setItem(positionKey, String(ms));
        } catch {
          // ignore (private mode / quota)
        }
      }
    },
    [positionKey],
  );

  // Restore saved position once on mount.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(positionKey);
      if (!raw) return;
      const ms = Number(raw);
      if (!Number.isFinite(ms) || ms <= 0) return;
      // Wait briefly for the YT player to finish loading before seeking.
      const timer = setTimeout(() => playerRef.current?.seekTo(ms), 800);
      return () => clearTimeout(timer);
    } catch {
      // ignore
    }
  }, [positionKey]);

  const handleSeek = useCallback((ms: number) => {
    playerRef.current?.seekTo(ms);
    playerRef.current?.play();
  }, []);

  const onSavedWord = useCallback((id: string) => {
    setSavedWords((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);
  const onSavedIdiom = useCallback((id: string) => {
    setSavedIdioms((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);
  const onSavedCustom = useCallback((term: string) => {
    setSavedCustoms((prev) => {
      const lower = term.toLowerCase();
      if (prev.has(lower)) return prev;
      const next = new Set(prev);
      next.add(lower);
      return next;
    });
  }, []);

  return (
    <Grid>
      <Grid.Col span={{ base: 12, md: 7 }}>
        <YoutubeIFramePlayer
          youtubeId={youtubeId}
          onTime={handleTime}
          controlRef={playerRef}
        />
      </Grid.Col>
      <Grid.Col span={{ base: 12, md: 5 }}>
        <SubtitleList
          videoId={videoId}
          cues={cues}
          currentMs={currentMs}
          wordsDict={wordsDict}
          idiomsDict={idiomsDict}
          savedWordIds={savedWords}
          savedIdiomIds={savedIdioms}
          savedCustomTerms={savedCustoms}
          onSavedWord={onSavedWord}
          onSavedIdiom={onSavedIdiom}
          onSavedCustom={onSavedCustom}
          onSeek={handleSeek}
        />
      </Grid.Col>
    </Grid>
  );
}
