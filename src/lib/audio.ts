// Client-side helpers for decoding Gemini TTS base64 audio and playing it.
// Gemini returns PCM16 (typically `audio/l16;rate=24000`), so we wrap it in a
// WAV RIFF header before handing it to <audio>.

export type PlayOptions = {
  mimeType?: string;
  playbackRate?: number;
};

function normalizeBase64(b64: string): string {
  const cleaned = b64.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  const pad = cleaned.length % 4;
  return pad === 0 ? cleaned : cleaned + '='.repeat(4 - pad);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(normalizeBase64(b64));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function parseSampleRate(mime: string): number {
  const m = mime.match(/(?:^|;)\s*rate=(\d+)/i);
  const n = m ? Number(m[1]) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 24000;
}

function isPcm16(mime: string): boolean {
  const lower = mime.toLowerCase();
  return (
    lower.startsWith('audio/l16') ||
    lower.includes('codec=pcm') ||
    lower.startsWith('audio/pcm')
  );
}

function pcm16ToWav(
  pcm: Uint8Array,
  sampleRate: number,
  channels = 1,
): Uint8Array {
  const bitsPerSample = 16;
  const blockAlign = (channels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcm.length;
  const buf = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buf);
  const write = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  write(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  write(36, 'data');
  view.setUint32(40, dataSize, true);
  new Uint8Array(buf, 44).set(pcm);
  return new Uint8Array(buf);
}

/** Turn Gemini base64 PCM16 (or any audio base64) into a playable Blob. */
export function base64ToAudioBlob(base64: string, mimeType: string): Blob {
  let bytes = base64ToBytes(base64);
  let blobType = mimeType;
  if (isPcm16(mimeType)) {
    bytes = pcm16ToWav(bytes, parseSampleRate(mimeType), 1);
    blobType = 'audio/wav';
  }
  return new Blob([bytes as BlobPart], { type: blobType });
}

/** Play base64-encoded audio. Handles Gemini's PCM16 → WAV conversion. */
export async function playBase64Audio(
  base64: string,
  options: PlayOptions = {},
): Promise<void> {
  const blob = base64ToAudioBlob(base64, options.mimeType ?? 'audio/wav');
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  if (options.playbackRate) audio.playbackRate = options.playbackRate;
  try {
    await audio.play();
    await new Promise<void>((resolve) => {
      audio.addEventListener('ended', () => resolve(), { once: true });
      audio.addEventListener('error', () => resolve(), { once: true });
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
