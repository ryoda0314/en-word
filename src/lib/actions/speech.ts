'use server';

import crypto from 'node:crypto';

import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';

import { isApproved } from '@/lib/auth/approval';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { splitSentences } from '@/lib/text/sentences';

const TTS_MODEL = 'gemini-2.5-flash-preview-tts';
const DEFAULT_VOICE = 'Kore';
const DEFAULT_LANG = 'en-US';
const BUCKET = 'tts-audio';

const inputSchema = z.object({
  text: z.string().min(1).max(8000),
  voice: z.string().max(50).optional(),
  languageCode: z.string().max(20).optional(),
  slow: z.boolean().optional(),
});

export type SentenceTiming = { startSec: number; endSec: number };

export type SpeechResult =
  | {
      ok: true;
      audioUrl: string;
      sentenceTimings?: SentenceTiming[];
      cached: boolean;
    }
  | {
      ok: false;
      error:
        | 'UNAUTHENTICATED'
        | 'NOT_APPROVED'
        | 'RATE_LIMITED'
        | 'TTS_FAILED'
        | 'INVALID'
        | 'NOT_CONFIGURED';
    };

function sha256Hex(
  text: string,
  voice: string,
  languageCode: string,
  slow: boolean,
): string {
  return crypto
    .createHash('sha256')
    .update(`${languageCode}::${voice}::${slow ? 'slow' : 'norm'}::${text}`, 'utf8')
    .digest('hex');
}

function getPublicUrl(hash: string): string {
  const service = createSupabaseServiceClient();
  const { data } = service.storage.from(BUCKET).getPublicUrl(`${hash}.wav`);
  return data.publicUrl;
}

async function urlExists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    return res.ok;
  } catch {
    return false;
  }
}

function parseSampleRate(mimeType: string): number {
  const m = mimeType.match(/(?:^|;)\s*rate=(\d+)/i);
  const n = m ? Number(m[1]) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 24000;
}

function isPcm16(mimeType: string): boolean {
  const l = mimeType.toLowerCase();
  return l.startsWith('audio/l16') || l.includes('codec=pcm') || l.startsWith('audio/pcm');
}

function pcm16ToWav(pcm: Uint8Array, sampleRate: number, channels = 1): Uint8Array {
  const bitsPerSample = 16;
  const blockAlign = (channels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcm.length;
  const buf = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buf);
  const w = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  w(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  w(36, 'data');
  view.setUint32(40, dataSize, true);
  new Uint8Array(buf, 44).set(pcm);
  return new Uint8Array(buf);
}

async function uploadWav(hash: string, wavBytes: Uint8Array): Promise<boolean> {
  const service = createSupabaseServiceClient();
  const { error } = await service.storage
    .from(BUCKET)
    .upload(`${hash}.wav`, wavBytes as BlobPart, {
      contentType: 'audio/wav',
      upsert: true,
    });
  if (error) {
    console.error('[TTS] Upload failed:', error.message);
    return false;
  }
  return true;
}

async function uploadTimings(
  hash: string,
  timings: SentenceTiming[],
): Promise<void> {
  const service = createSupabaseServiceClient();
  const json = new TextEncoder().encode(JSON.stringify(timings));
  const { error } = await service.storage
    .from(BUCKET)
    .upload(`${hash}.json`, json as BlobPart, {
      contentType: 'application/json',
      upsert: true,
    });
  if (error) console.error('[TTS] Timings upload failed:', error.message);
}

async function fetchStoredTimings(
  hash: string,
): Promise<SentenceTiming[] | undefined> {
  const service = createSupabaseServiceClient();
  const { data } = service.storage.from(BUCKET).getPublicUrl(`${hash}.json`);
  try {
    const res = await fetch(data.publicUrl, { cache: 'no-store' });
    if (!res.ok) return undefined;
    const json = await res.json();
    if (
      Array.isArray(json) &&
      json.every(
        (x) =>
          x &&
          typeof x.startSec === 'number' &&
          typeof x.endSec === 'number',
      )
    ) {
      return json as SentenceTiming[];
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

/**
 * Detect "silence" regions in raw PCM16 little-endian mono audio.
 * Used to locate sentence boundaries in generated narration.
 */
function detectSilences(
  pcm: Uint8Array,
  sampleRate: number,
): Array<{ startSec: number; endSec: number; durationSec: number }> {
  const sampleCount = Math.floor(pcm.length / 2);
  const windowSize = Math.max(1, Math.floor(sampleRate * 0.02)); // 20ms
  const hopSize = Math.max(1, Math.floor(sampleRate * 0.01)); // 10ms
  const silenceThreshold = 450; // RMS amplitude (signed 16-bit range)
  const minSilenceSec = 0.18;

  const amps: number[] = [];
  for (let i = 0; i + windowSize < sampleCount; i += hopSize) {
    let sum = 0;
    for (let j = 0; j < windowSize; j++) {
      const idx = (i + j) * 2;
      const lo = pcm[idx];
      const hi = pcm[idx + 1];
      let s = lo | (hi << 8);
      if (s > 32767) s -= 65536;
      sum += s * s;
    }
    amps.push(Math.sqrt(sum / windowSize));
  }

  const silences: Array<{
    startSec: number;
    endSec: number;
    durationSec: number;
  }> = [];
  let runStart: number | null = null;
  const pushIfLongEnough = (startIdx: number, endIdx: number) => {
    const durationSec = ((endIdx - startIdx) * hopSize) / sampleRate;
    if (durationSec >= minSilenceSec) {
      silences.push({
        startSec: (startIdx * hopSize) / sampleRate,
        endSec: (endIdx * hopSize) / sampleRate,
        durationSec,
      });
    }
  };
  for (let i = 0; i < amps.length; i++) {
    if (amps[i] < silenceThreshold) {
      if (runStart === null) runStart = i;
    } else if (runStart !== null) {
      pushIfLongEnough(runStart, i);
      runStart = null;
    }
  }
  if (runStart !== null) pushIfLongEnough(runStart, amps.length);

  return silences;
}

function computeSentenceTimings(
  pcm: Uint8Array,
  sampleRate: number,
  sentenceCount: number,
  totalDurationSec: number,
): SentenceTiming[] | null {
  if (sentenceCount <= 1) {
    return [{ startSec: 0, endSec: totalDurationSec }];
  }

  const allSilences = detectSilences(pcm, sampleRate);
  // Drop leading/trailing silences — we only care about internal breaks.
  const internal = allSilences.filter(
    (s) => s.startSec > 0.12 && s.endSec < totalDurationSec - 0.12,
  );

  const needed = sentenceCount - 1;
  if (internal.length < needed) {
    return null;
  }

  const topN = [...internal]
    .sort((a, b) => b.durationSec - a.durationSec)
    .slice(0, needed)
    .sort((a, b) => a.startSec - b.startSec);

  const timings: SentenceTiming[] = [];
  let prev = 0;
  for (let i = 0; i < sentenceCount; i++) {
    // Cut each sentence boundary at the midpoint of the silence after it.
    const cutSec =
      i < needed
        ? (topN[i].startSec + topN[i].endSec) / 2
        : totalDurationSec;
    timings.push({ startSec: prev, endSec: cutSec });
    prev = cutSec;
  }
  return timings;
}

export async function generateSpeech(
  input: z.input<typeof inputSchema>,
): Promise<SpeechResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'INVALID' };
  const {
    text,
    voice = DEFAULT_VOICE,
    languageCode = DEFAULT_LANG,
    slow = false,
  } = parsed.data;

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) return { ok: false, error: 'NOT_CONFIGURED' };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'UNAUTHENTICATED' };
  if (!(await isApproved(supabase))) return { ok: false, error: 'NOT_APPROVED' };

  const hash = sha256Hex(text.trim(), voice, languageCode, slow);
  const publicUrl = getPublicUrl(hash);

  // Storage cache: if the file already exists, skip Gemini entirely.
  if (await urlExists(publicUrl)) {
    const timings = await fetchStoredTimings(hash);
    return {
      ok: true,
      audioUrl: publicUrl,
      sentenceTimings: timings,
      cached: true,
    };
  }

  // Rate limit only before we actually hit Gemini.
  const allowed = await checkAndBumpRate(user.id, 'gemini.tts', 30);
  if (!allowed) return { ok: false, error: 'RATE_LIMITED' };

  const prompt = slow
    ? `Read the following text slowly and clearly for a language learner: "${text}"`
    : text;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: TTS_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          languageCode,
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    });

    const candidates =
      (response as { candidates?: GeminiCandidate[] }).candidates ??
      (response as { response?: { candidates?: GeminiCandidate[] } }).response
        ?.candidates;
    const part = candidates?.[0]?.content?.parts?.[0];
    const dataB64 = part?.inlineData?.data;
    const mimeType = part?.inlineData?.mimeType;

    if (!dataB64 || !mimeType?.startsWith('audio')) {
      console.error('[TTS] Unexpected response shape', response);
      return { ok: false, error: 'TTS_FAILED' };
    }

    // Convert PCM16 → WAV (so browsers can play the file directly from URL).
    const rawBytes = new Uint8Array(Buffer.from(dataB64, 'base64'));
    const sampleRate = parseSampleRate(mimeType);
    const wavBytes = isPcm16(mimeType)
      ? pcm16ToWav(rawBytes, sampleRate)
      : rawBytes;

    const uploaded = await uploadWav(hash, wavBytes);
    if (!uploaded) {
      return { ok: false, error: 'TTS_FAILED' };
    }

    // Compute per-sentence timings via silence detection and persist them.
    let timings: SentenceTiming[] | undefined;
    if (isPcm16(mimeType)) {
      const totalDurationSec = rawBytes.length / 2 / sampleRate;
      const sentences = splitSentences(text.trim());
      const detected = computeSentenceTimings(
        rawBytes,
        sampleRate,
        sentences.length,
        totalDurationSec,
      );
      if (detected) {
        timings = detected;
        await uploadTimings(hash, detected);
      }
    }

    return {
      ok: true,
      audioUrl: publicUrl,
      sentenceTimings: timings,
      cached: false,
    };
  } catch (err) {
    console.error('[TTS] Gemini error', err);
    return { ok: false, error: 'TTS_FAILED' };
  }
}

type GeminiCandidate = {
  content?: {
    parts?: Array<{
      inlineData?: { data?: string; mimeType?: string };
    }>;
  };
};

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
    await service
      .from('rate_limits')
      .insert({ user_id: userId, action, window_start: iso, count: 1 });
  }
  return true;
}
