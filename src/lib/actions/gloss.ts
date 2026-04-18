'use server';

import OpenAI from 'openai';
import { z } from 'zod';

import { lemmatize } from '@/lib/text/lemmatize';
import { isApproved } from '@/lib/auth/approval';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';

const inputSchema = z.object({
  term: z.string().min(1).max(200),
  kind: z.enum(['word', 'phrase']),
  context: z.string().max(1000).optional(),
});

const glossSchema = z.object({
  headword: z.string(),
  pos: z.string(),
  ipa: z.string(),
  meaning_ja: z.string(),
  meaning_en: z.string(),
  example_en: z.string(),
  example_ja: z.string(),
});

export type GlossData = {
  headword: string;
  pos: string | null;
  ipa: string | null;
  meaning_ja: string;
  meaning_en: string;
  example_en: string;
  example_ja: string;
  wordId: string | null;
  idiomId: string | null;
  source: 'dict' | 'ai';
};

export type GlossResult =
  | { ok: true; gloss: GlossData }
  | {
      ok: false;
      error:
        | 'UNAUTHENTICATED'
        | 'NOT_APPROVED'
        | 'RATE_LIMITED'
        | 'AI_FAILED'
        | 'INVALID';
    };

const SYSTEM_PROMPT_WORD = `You are a concise English lexicographer writing for Japanese learners preparing for TOEIC/TOEFL.
Return a JSON object matching the schema.
- headword: base (lemma) form, lowercase
- pos: short POS tag (noun | verb | adj | adv | phrase | other)
- ipa: broad IPA in slashes
- meaning_ja: Japanese meaning, concise (under 40 characters)
- meaning_en: English gloss, under 15 words
- example_en: one natural example sentence using the headword; if a context sentence was given, stay near its topic
- example_ja: faithful Japanese translation of example_en`;

const SYSTEM_PROMPT_PHRASE = `You are a concise English lexicographer writing for Japanese learners preparing for TOEIC/TOEFL.
Treat the input as a multi-word expression (idiom, collocation, or phrasal verb).
Return a JSON object matching the schema.
- headword: the phrase itself (normalize casing, lowercase)
- pos: "phrase"
- ipa: leave an empty string
- meaning_ja: Japanese meaning, concise (under 50 characters)
- meaning_en: English gloss, under 20 words
- example_en: one natural example using the whole phrase; stay near the context topic if given
- example_ja: faithful Japanese translation`;

export async function lookupGloss(
  input: z.input<typeof inputSchema>,
): Promise<GlossResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'INVALID' };
  const { term, kind, context } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'UNAUTHENTICATED' };
  if (!(await isApproved(supabase))) {
    return { ok: false, error: 'NOT_APPROVED' };
  }

  const normalizedTerm =
    kind === 'word' ? lemmatize(term) : term.trim().toLowerCase().replace(/\s+/g, ' ');

  // 1. Cache lookup
  if (kind === 'word') {
    const { data: existing } = await supabase
      .from('words')
      .select('*')
      .eq('lemma', normalizedTerm)
      .maybeSingle();
    if (existing) {
      return {
        ok: true,
        gloss: {
          headword: existing.lemma,
          pos: existing.pos,
          ipa: existing.ipa,
          meaning_ja: existing.meaning_ja ?? '',
          meaning_en: existing.meaning_en ?? '',
          example_en: existing.example_en ?? '',
          example_ja: existing.example_ja ?? '',
          wordId: existing.id,
          idiomId: null,
          source: 'dict',
        },
      };
    }
  } else {
    const { data: existingIdiom } = await supabase
      .from('idioms')
      .select('*')
      .eq('phrase', normalizedTerm)
      .maybeSingle();
    if (existingIdiom) {
      return {
        ok: true,
        gloss: {
          headword: existingIdiom.phrase,
          pos: 'phrase',
          ipa: null,
          meaning_ja: existingIdiom.meaning_ja ?? '',
          meaning_en: existingIdiom.meaning_en ?? '',
          example_en: existingIdiom.example_en ?? '',
          example_ja: existingIdiom.example_ja ?? '',
          wordId: null,
          idiomId: existingIdiom.id,
          source: 'dict',
        },
      };
    }
  }

  // 2. Rate limit (per-minute window)
  const allowed = await checkAndBumpRate(user.id, 'openai.gloss', 20);
  if (!allowed) return { ok: false, error: 'RATE_LIMITED' };

  // 3. Ask OpenAI
  if (!process.env.OPENAI_API_KEY) {
    return { ok: false, error: 'AI_FAILED' };
  }
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const userPrompt =
    kind === 'word'
      ? `Word: "${term}"\nContext sentence: ${context ?? '(none)'}`
      : `Phrase: "${term}"\nContext sentence: ${context ?? '(none)'}`;

  let aiJson: z.infer<typeof glossSchema>;
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      max_tokens: 400,
      messages: [
        {
          role: 'system',
          content: kind === 'word' ? SYSTEM_PROMPT_WORD : SYSTEM_PROMPT_PHRASE,
        },
        { role: 'user', content: userPrompt },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'gloss',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              headword: { type: 'string' },
              pos: { type: 'string' },
              ipa: { type: 'string' },
              meaning_ja: { type: 'string' },
              meaning_en: { type: 'string' },
              example_en: { type: 'string' },
              example_ja: { type: 'string' },
            },
            required: [
              'headword',
              'pos',
              'ipa',
              'meaning_ja',
              'meaning_en',
              'example_en',
              'example_ja',
            ],
          },
        },
      },
    });
    const raw = completion.choices[0]?.message?.content ?? '{}';
    aiJson = glossSchema.parse(JSON.parse(raw));
  } catch (err) {
    console.error('OpenAI gloss failed:', err);
    return { ok: false, error: 'AI_FAILED' };
  }

  // 4. Cache back into dict tables
  const service = createSupabaseServiceClient();
  if (kind === 'word') {
    const lemma = lemmatize(aiJson.headword);
    const { data: upserted } = await service
      .from('words')
      .upsert(
        {
          lemma,
          pos: aiJson.pos || null,
          ipa: aiJson.ipa || null,
          meaning_ja: aiJson.meaning_ja,
          meaning_en: aiJson.meaning_en,
          example_en: aiJson.example_en,
          example_ja: aiJson.example_ja,
        },
        { onConflict: 'lemma' },
      )
      .select('id')
      .single();
    return {
      ok: true,
      gloss: {
        headword: lemma,
        pos: aiJson.pos || null,
        ipa: aiJson.ipa || null,
        meaning_ja: aiJson.meaning_ja,
        meaning_en: aiJson.meaning_en,
        example_en: aiJson.example_en,
        example_ja: aiJson.example_ja,
        wordId: upserted?.id ?? null,
        idiomId: null,
        source: 'ai',
      },
    };
  } else {
    const phrase = normalizedTerm;
    const { data: upserted } = await service
      .from('idioms')
      .upsert(
        {
          phrase,
          meaning_ja: aiJson.meaning_ja,
          meaning_en: aiJson.meaning_en,
          example_en: aiJson.example_en,
          example_ja: aiJson.example_ja,
        },
        { onConflict: 'phrase' },
      )
      .select('id')
      .single();
    return {
      ok: true,
      gloss: {
        headword: phrase,
        pos: 'phrase',
        ipa: null,
        meaning_ja: aiJson.meaning_ja,
        meaning_en: aiJson.meaning_en,
        example_en: aiJson.example_en,
        example_ja: aiJson.example_ja,
        wordId: null,
        idiomId: upserted?.id ?? null,
        source: 'ai',
      },
    };
  }
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
