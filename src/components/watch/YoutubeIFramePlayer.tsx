'use client';

import { useEffect, useImperativeHandle, useRef } from 'react';
import Script from 'next/script';

type YTStateCode = -1 | 0 | 1 | 2 | 3 | 5;

type Props = {
  youtubeId: string;
  onTime?: (ms: number) => void;
  onStateChange?: (state: YTStateCode) => void;
  controlRef?: React.Ref<PlayerHandle>;
};

export type PlayerHandle = {
  seekTo(ms: number): void;
  play(): void;
  pause(): void;
};

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
    __ytApiPromise?: Promise<void>;
  }
}

function loadYtApi(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('ssr'));
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (window.__ytApiPromise) return window.__ytApiPromise;
  window.__ytApiPromise = new Promise<void>((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
  });
  return window.__ytApiPromise;
}

export function YoutubeIFramePlayer({
  youtubeId,
  onTime,
  onStateChange,
  controlRef,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useImperativeHandle(
    controlRef,
    () => ({
      seekTo(ms: number) {
        playerRef.current?.seekTo?.(ms / 1000, true);
      },
      play() {
        playerRef.current?.playVideo?.();
      },
      pause() {
        playerRef.current?.pauseVideo?.();
      },
    }),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    loadYtApi().then(() => {
      if (cancelled || !hostRef.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const YT = (window.YT as any);
      playerRef.current = new YT.Player(hostRef.current, {
        videoId: youtubeId,
        playerVars: {
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
        },
        events: {
          onStateChange: (e: { data: YTStateCode }) => {
            onStateChange?.(e.data);
            if (e.data === 1 /* PLAYING */) {
              if (intervalRef.current) clearInterval(intervalRef.current);
              intervalRef.current = setInterval(() => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const p = playerRef.current as any;
                const sec = p?.getCurrentTime?.();
                if (typeof sec === 'number') {
                  onTime?.(Math.round(sec * 1000));
                }
              }, 200);
            } else {
              if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
              }
            }
          },
        },
      });
    });
    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      try {
        playerRef.current?.destroy?.();
      } catch {
        // ignore
      }
      playerRef.current = null;
    };
  }, [youtubeId, onTime, onStateChange]);

  return (
    <>
      <Script src="https://www.youtube.com/iframe_api" strategy="afterInteractive" />
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16 / 9',
          background: '#000',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        <div
          ref={hostRef}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        />
      </div>
    </>
  );
}
