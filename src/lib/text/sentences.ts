export type Sentence = {
  text: string;
  charStart: number;
  charEnd: number;
  /** Playback timing filled in on the client once the audio duration is known. */
  startSec?: number;
  endSec?: number;
};

/**
 * Split a passage into sentences, preserving original character offsets so the
 * UI can map playback position back to token positions. Simple English-only
 * heuristic: break on `.`, `!`, `?` followed by whitespace or end of string.
 */
export function splitSentences(body: string): Sentence[] {
  const result: Sentence[] = [];
  let cursor = 0;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === '.' || c === '!' || c === '?') {
      let end = i + 1;
      while (end < body.length && /[\s\n]/.test(body[end])) end++;
      const piece = body.slice(cursor, end);
      if (piece.trim().length > 0) {
        result.push({
          text: body.slice(cursor, i + 1).trim(),
          charStart: cursor,
          charEnd: end,
        });
      }
      cursor = end;
    }
  }
  if (cursor < body.length) {
    const tail = body.slice(cursor);
    if (tail.trim().length > 0) {
      result.push({
        text: tail.trim(),
        charStart: cursor,
        charEnd: body.length,
      });
    }
  }
  return result;
}
