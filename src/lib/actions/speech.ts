'use server';

import crypto from 'node:crypto';

import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';

import { isApproved } from '@/lib/auth/approval';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';

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

/**
 * Word-level timings aligned to the ordered word list of the input text.
 * `wordTimings[i]` is the start second for the i-th word (non-whitespace,
 * non-punctuation token). If alignment fails for a given word, the entry is
 * `null` (client will treat it as "unknown, skip highlight").
 */
export type WordTimings = Array<number | null>;

export type SpeechResult =
  | {
      ok: true;
      audioUrl: string;
      wordTimings?: WordTimings;
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

const WORD_RE = /\p{L}+(?:[''\-]\p{L}+)*/gu;

function extractWords(text: string): string[] {
  return Array.from(text.matchAll(WORD_RE), (m) => m[0]);
}

function normalizeWord(s: string): string {
  return s.toLowerCase().replace(/[''\-]/g, '').trim();
}

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

async function uploadWordTimings(
  hash: string,
  timings: WordTimings,
): Promise<void> {
  const service = createSupabaseServiceClient();
  const json = new TextEncoder().encode(JSON.stringify(timings));
  const { error } = await service.storage
    .from(BUCKET)
    .upload(`${hash}.words.json`, json as BlobPart, {
      contentType: 'application/json',
      upsert: true,
    });
  if (error) console.error('[TTS] word timings upload failed:', error.message);
}

async function fetchStoredWordTimings(
  hash: string,
): Promise<WordTimings | undefined> {
  const service = createSupabaseServiceClient();
  const { data } = service.storage
    .from(BUCKET)
    .getPublicUrl(`${hash}.words.json`);
  try {
    const res = await fetch(data.publicUrl, { cache: 'no-store' });
    if (!res.ok) return undefined;
    const json = await res.json();
    if (
      Array.isArray(json) &&
      json.every((x) => x === null || typeof x === 'number')
    ) {
      return json as WordTimings;
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

/**
 * Ask Gemini Flash to give the start time (in seconds) of every spoken word
 * in the supplied WAV, then align Gemini's output to our own word-token order.
 * Returns `null` if alignment quality is poor — callers must handle missing
 * timings gracefully (no highlight).
 */
async function alignWordTimings(
  apiKey: string,
  wavBase64: string,
  text: string,
  totalDurationSec: number,
): Promise<WordTimings | null> {
  const expectedWords = extractWords(text);
  if (expectedWords.length < 2) return null;

  let parsed: Array<{ word?: string; startSec?: number }>;
  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Listen to the audio attached. It is a recitation of the following text:

"${text}"

Return a single JSON array. Each element is {"word": string, "startSec": number}, one entry per word as it occurs in the transcript, in the same order. "startSec" is the time in seconds (decimal, from the start of the audio) when that word begins being spoken. Use the exact surface form of the word as written in the transcript. Include punctuation within the word only if the transcript has it inside the word (e.g., "don't"). Do not output anything other than the JSON array.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: 'audio/wav',
                data: wavBase64,
              },
            },
            { text: prompt },
          ],
        },
      ],
      config: { responseMimeType: 'application/json' },
    });

    const raw = (response as { text?: string }).text ?? '';
    parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
  } catch (err) {
    console.error('[TTS] Gemini alignment error', err);
    return null;
  }

  // Sequential alignment with normalized compare.
  const result: WordTimings = [];
  let gi = 0;
  for (const expected of expectedWords) {
    const target = normalizeWord(expected);
    let matched: number | null = null;
    const lookahead = 3;
    const maxG = Math.min(parsed.length, gi + lookahead);
    for (let j = gi; j < maxG; j++) {
      if (normalizeWord(parsed[j].word ?? '') === target) {
        const t = Number(parsed[j].startSec);
        if (
          Number.isFinite(t) &&
          t >= 0 &&
          t <= totalDurationSec + 0.5
        ) {
          matched = t;
        }
        gi = j + 1;
        break;
      }
    }
    result.push(matched);
  }

  // Validate: at least 70% of tokens must have a usable timing, and they
  // must be monotonically non-decreasing.
  const matched = result.filter((t) => t !== null).length;
  if (matched / result.length < 0.7) return null;
  let last = -Infinity;
  for (const t of result) {
    if (t === null) continue;
    if (t < last - 0.2) return null; // allow tiny jitter
    last = t;
  }
  return result;
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

  // Storage cache: if the file already exists, skip Gemini TTS entirely.
  if (await urlExists(publicUrl)) {
    let timings = await fetchStoredWordTimings(hash);
    // Backfill: if audio was generated before word-alignment was added, try
    // to align now using the cached WAV.
    if (!timings) {
      try {
        const res = await fetch(publicUrl, { cache: 'no-store' });
        if (res.ok) {
          const wavBuf = Buffer.from(await res.arrayBuffer());
          // Crude total duration: parse WAV header (bytes 40..44).
          const dataSize = wavBuf.readUInt32LE(40);
          const sampleRate = wavBuf.readUInt32LE(24);
          const totalSec = dataSize / 2 / sampleRate;
          const backfilled = await alignWordTimings(
            apiKey,
            wavBuf.toString('base64'),
            text.trim(),
            totalSec,
          );
          if (backfilled) {
            await uploadWordTimings(hash, backfilled);
            timings = backfilled;
          }
        }
      } catch (err) {
        console.error('[TTS] Backfill alignment failed', err);
      }
    }
    return {
      ok: true,
      audioUrl: publicUrl,
      wordTimings: timings,
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

    // Ask Gemini Flash to word-align the recording back to the text.
    const wavBase64 = Buffer.from(wavBytes).toString('base64');
    const totalDurationSec = isPcm16(mimeType)
      ? rawBytes.length / 2 / sampleRate
      : 0;
    let wordTimings: WordTimings | undefined;
    try {
      const aligned = await alignWordTimings(
        apiKey,
        wavBase64,
        text.trim(),
        totalDurationSec,
      );
      if (aligned) {
        wordTimings = aligned;
        await uploadWordTimings(hash, aligned);
      }
    } catch (err) {
      console.error('[TTS] Alignment skipped', err);
    }

    return {
      ok: true,
      audioUrl: publicUrl,
      wordTimings,
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
