'use server';

// Import the ESM dist file directly: the package.json declares "type":"module"
// but its `main` entry uses CJS exports syntax, which Node.js 24 rejects.
// The ESM file has proper `export {}` and is safe to bundle with Turbopack.
import {
  YoutubeTranscript,
  YoutubeTranscriptDisabledError,
  YoutubeTranscriptError,
  YoutubeTranscriptNotAvailableError,
  YoutubeTranscriptNotAvailableLanguageError,
  YoutubeTranscriptTooManyRequestError,
  YoutubeTranscriptVideoUnavailableError,
} from 'youtube-transcript/dist/youtube-transcript.esm.js';
import type { TranscriptResponse } from 'youtube-transcript';
import { z } from 'zod';

import { isApproved } from '@/lib/auth/approval';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import type { VideoCueRow, VideoRow } from '@/types/db';

const urlSchema = z.object({ url: z.string().min(1).max(500) });

export type ImportYoutubeResult =
  | { ok: true; video: VideoRow; cueCount: number; cached: boolean }
  | {
      ok: false;
      error:
        | 'UNAUTHENTICATED'
        | 'NOT_APPROVED'
        | 'INVALID_URL'
        | 'NO_TRANSCRIPT'
        | 'NOT_FOUND'
        | 'YOUTUBE_THROTTLED'
        | 'RATE_LIMITED'
        | 'SAVE_FAILED';
    };

export type GetVideoWithCuesResult =
  | { ok: true; video: VideoRow; cues: VideoCueRow[] }
  | { ok: false; error: 'NOT_FOUND' | 'UNAUTHENTICATED' | 'NOT_APPROVED' };

const YOUTUBE_ID_RE =
  /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;

export async function extractYoutubeId(input: string): Promise<string | null> {
  const trimmed = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(YOUTUBE_ID_RE);
  return match?.[1] ?? null;
}

export async function importYoutubeVideo(
  input: z.input<typeof urlSchema>,
): Promise<ImportYoutubeResult> {
  const parsed = urlSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'INVALID_URL' };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'UNAUTHENTICATED' };
  if (!(await isApproved(supabase))) {
    return { ok: false, error: 'NOT_APPROVED' };
  }

  const youtubeId = await extractYoutubeId(parsed.data.url);
  if (!youtubeId) return { ok: false, error: 'INVALID_URL' };

  const service = createSupabaseServiceClient();

  // Cache hit: return without consuming rate limit.
  const { data: existing } = await service
    .from('videos')
    .select('id, youtube_id, title, lang, created_at')
    .eq('youtube_id', youtubeId)
    .maybeSingle();

  if (existing) {
    const { count } = await service
      .from('video_cues')
      .select('*', { count: 'exact', head: true })
      .eq('video_id', existing.id);
    return { ok: true, video: existing, cueCount: count ?? 0, cached: true };
  }

  const allowed = await checkAndBumpRate(user.id, 'youtube.import', 5);
  if (!allowed) return { ok: false, error: 'RATE_LIMITED' };

  let raw: TranscriptResponse[];
  try {
    raw = await YoutubeTranscript.fetchTranscript(youtubeId, { lang: 'en' });
  } catch (err) {
    return mapTranscriptError(err);
  }
  const cues = normalizeCues(raw);
  if (!cues.length) return { ok: false, error: 'NO_TRANSCRIPT' };

  const lang = raw[0]?.lang ?? 'en';

  const { data: inserted, error: insertErr } = await service
    .from('videos')
    .insert({ youtube_id: youtubeId, title: null, lang })
    .select('id, youtube_id, title, lang, created_at')
    .single();
  if (insertErr || !inserted) {
    console.error('video insert failed:', insertErr);
    return { ok: false, error: 'SAVE_FAILED' };
  }

  const videoId = inserted.id;
  const rows = cues.map((c, i) => ({
    video_id: videoId,
    seq: i,
    start_ms: c.start_ms,
    end_ms: c.end_ms,
    text: c.text,
  }));

  const chunkSize = 500;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error: cueErr } = await service.from('video_cues').insert(chunk);
    if (cueErr) {
      console.error('video_cues insert failed:', cueErr);
      await service.from('videos').delete().eq('id', videoId);
      return { ok: false, error: 'SAVE_FAILED' };
    }
  }

  return { ok: true, video: inserted, cueCount: rows.length, cached: false };
}

export async function getVideoWithCues(
  youtubeId: string,
): Promise<GetVideoWithCuesResult> {
  if (!/^[A-Za-z0-9_-]{11}$/.test(youtubeId)) {
    return { ok: false, error: 'NOT_FOUND' };
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'UNAUTHENTICATED' };
  if (!(await isApproved(supabase))) {
    return { ok: false, error: 'NOT_APPROVED' };
  }

  const { data: video } = await supabase
    .from('videos')
    .select('id, youtube_id, title, lang, created_at')
    .eq('youtube_id', youtubeId)
    .maybeSingle();
  if (!video) return { ok: false, error: 'NOT_FOUND' };

  const { data: cues } = await supabase
    .from('video_cues')
    .select('id, video_id, seq, start_ms, end_ms, text')
    .eq('video_id', video.id)
    .order('seq', { ascending: true });

  return { ok: true, video, cues: cues ?? [] };
}

// --- helpers ---------------------------------------------------------------

function mapTranscriptError(err: unknown): ImportYoutubeResult {
  if (err instanceof YoutubeTranscriptTooManyRequestError) {
    return { ok: false, error: 'YOUTUBE_THROTTLED' };
  }
  if (err instanceof YoutubeTranscriptVideoUnavailableError) {
    return { ok: false, error: 'NOT_FOUND' };
  }
  if (
    err instanceof YoutubeTranscriptDisabledError ||
    err instanceof YoutubeTranscriptNotAvailableError ||
    err instanceof YoutubeTranscriptNotAvailableLanguageError
  ) {
    return { ok: false, error: 'NO_TRANSCRIPT' };
  }
  if (err instanceof YoutubeTranscriptError) {
    console.error('youtube-transcript error:', err);
    return { ok: false, error: 'NO_TRANSCRIPT' };
  }
  console.error('unexpected transcript error:', err);
  return { ok: false, error: 'NO_TRANSCRIPT' };
}

type NormalizedCue = { start_ms: number; end_ms: number; text: string };

// youtube-transcript returns offset/duration in ms (srv3 path, integers) or
// seconds (classic path, floats). Detect by fractional values; if any are
// non-integer, the units are seconds.
function normalizeCues(raw: TranscriptResponse[]): NormalizedCue[] {
  const hasFractional = raw.some(
    (t) => !Number.isInteger(t.offset) || !Number.isInteger(t.duration),
  );
  const mult = hasFractional ? 1000 : 1;
  const result: NormalizedCue[] = [];
  for (const t of raw) {
    const text = t.text.replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const start = Math.max(0, Math.round(t.offset * mult));
    const dur = Math.max(0, Math.round(t.duration * mult));
    result.push({ start_ms: start, end_ms: start + dur, text });
  }
  return result;
}

async function checkAndBumpRate(
  userId: string,
  action: string,
  maxPerMinute: number,
): Promise<boolean> {
  const service = createSupabaseServiceClient();
  const windowStart = new Date();
  windowStart.setSeconds(0, 0);
  const iso = windowStart.toISOString();

  const { data: existing } = await service
    .from('rate_limits')
    .select('count')
    .eq('user_id', userId)
    .eq('action', action)
    .eq('window_start', iso)
    .maybeSingle();

  if (existing && existing.count >= maxPerMinute) return false;

  if (existing) {
    await service
      .from('rate_limits')
      .update({ count: existing.count + 1 })
      .eq('user_id', userId)
      .eq('action', action)
      .eq('window_start', iso);
  } else {
    await service.from('rate_limits').insert({
      user_id: userId,
      action,
      window_start: iso,
      count: 1,
    });
  }
  return true;
}
