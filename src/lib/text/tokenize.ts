import { lemmatize } from './lemmatize';

export type PassageToken =
  | { kind: 'text'; text: string }
  | {
      kind: 'word';
      id: number;
      surface: string;
      lemma: string;
      wordId: string | null;
      idiomSpanIds: number[];
      charStart: number;
      charEnd: number;
    };

export type IdiomSpan = {
  id: number;
  idiomId: string;
  startWordId: number;
  endWordId: number;
  charStart: number;
  charEnd: number;
};

export type TokenizeInput = {
  body: string;
  wordsByLemma: Map<string, { id: string }>;
  idioms: ReadonlyArray<{ id: string; phrase: string }>;
};

export type TokenizeResult = {
  tokens: PassageToken[];
  idiomSpans: IdiomSpan[];
};

// Unicode-aware word regex. Matches Latin word characters plus intra-word
// apostrophes ("don't", "it's") and hyphens ("long-term").
const WORD_RE = /\p{L}+(?:[''-]\p{L}+)*/gu;

export function tokenizePassage({
  body,
  wordsByLemma,
  idioms,
}: TokenizeInput): TokenizeResult {
  const tokens: PassageToken[] = [];
  const wordIndexById = new Map<number, number>(); // id -> position in tokens array
  let cursor = 0;
  let wordIdCounter = 0;

  for (const match of body.matchAll(WORD_RE)) {
    const start = match.index ?? 0;
    const surface = match[0];
    if (start > cursor) {
      tokens.push({ kind: 'text', text: body.slice(cursor, start) });
    }
    const lemma = lemmatize(surface);
    const dictWord = wordsByLemma.get(lemma);
    const id = wordIdCounter++;
    tokens.push({
      kind: 'word',
      id,
      surface,
      lemma,
      wordId: dictWord?.id ?? null,
      idiomSpanIds: [],
      charStart: start,
      charEnd: start + surface.length,
    });
    wordIndexById.set(id, tokens.length - 1);
    cursor = start + surface.length;
  }
  if (cursor < body.length) {
    tokens.push({ kind: 'text', text: body.slice(cursor) });
  }

  const wordLemmas: string[] = [];
  const wordIds: number[] = [];
  for (const t of tokens) {
    if (t.kind === 'word') {
      wordLemmas.push(t.lemma);
      wordIds.push(t.id);
    }
  }

  const idiomSpans: IdiomSpan[] = [];
  let idiomSpanIdCounter = 0;

  for (const idiom of idioms) {
    const phraseLemmas = idiom.phrase
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => lemmatize(w));
    if (phraseLemmas.length === 0) continue;

    for (let i = 0; i <= wordLemmas.length - phraseLemmas.length; i++) {
      let matched = true;
      for (let j = 0; j < phraseLemmas.length; j++) {
        if (wordLemmas[i + j] !== phraseLemmas[j]) {
          matched = false;
          break;
        }
      }
      if (matched) {
        const startIdx = wordIndexById.get(wordIds[i]);
        const endIdx = wordIndexById.get(wordIds[i + phraseLemmas.length - 1]);
        const startTok = startIdx !== undefined ? tokens[startIdx] : null;
        const endTok = endIdx !== undefined ? tokens[endIdx] : null;
        const span: IdiomSpan = {
          id: idiomSpanIdCounter++,
          idiomId: idiom.id,
          startWordId: wordIds[i],
          endWordId: wordIds[i + phraseLemmas.length - 1],
          charStart: startTok?.kind === 'word' ? startTok.charStart : 0,
          charEnd: endTok?.kind === 'word' ? endTok.charEnd : 0,
        };
        idiomSpans.push(span);
        for (let j = 0; j < phraseLemmas.length; j++) {
          const tokenIdx = wordIndexById.get(wordIds[i + j]);
          if (tokenIdx === undefined) continue;
          const token = tokens[tokenIdx];
          if (token.kind === 'word') token.idiomSpanIds.push(span.id);
        }
      }
    }
  }

  return { tokens, idiomSpans };
}
