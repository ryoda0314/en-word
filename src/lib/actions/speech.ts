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

export type SpeechResult =
  | { ok: true; audioUrl: string; cached: boolean }
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
    return { ok: true, audioUrl: publicUrl, cached: true };
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
    const rawBytes = Buffer.from(dataB64, 'base64');
    const wavBytes = isPcm16(mimeType)
      ? pcm16ToWav(new Uint8Array(rawBytes), parseSampleRate(mimeType))
      : new Uint8Array(rawBytes);

    const uploaded = await uploadWav(hash, wavBytes);
    if (!uploaded) {
      return { ok: false, error: 'TTS_FAILED' };
    }

    return { ok: true, audioUrl: publicUrl, cached: false };
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
