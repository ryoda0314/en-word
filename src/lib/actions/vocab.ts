'use server';

import { z } from 'zod';

import { createSupabaseServerClient } from '@/lib/supabase/server';

const schema = z
  .object({
    wordId: z.string().uuid().optional(),
    idiomId: z.string().uuid().optional(),
    customTerm: z.string().min(1).max(100).optional(),
    customMeaningJa: z.string().max(500).optional(),
    passageId: z.string().uuid().optional(),
    sourceVideoId: z.string().uuid().optional(),
    sourceVideoCueSeq: z.number().int().min(0).optional(),
    contextSentence: z.string().max(1000).optional(),
  })
  .refine(
    (v) =>
      [v.wordId, v.idiomId, v.customTerm].filter((x) => x !== undefined).length === 1,
    { message: 'Exactly one of wordId / idiomId / customTerm must be provided' },
  );

export type AddToVocabResult =
  | { ok: true; id: string; alreadySaved: boolean }
  | { ok: false; error: string };

export type DeleteVocabResult = { ok: true } | { ok: false; error: string };

export async function deleteVocab(id: string): Promise<DeleteVocabResult> {
  if (!id) return { ok: false, error: 'invalid id' };
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'UNAUTHENTICATED' };
  const { error } = await supabase
    .from('user_vocab')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function addToVocab(
  input: z.input<typeof schema>,
): Promise<AddToVocabResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'invalid input' };
  }
  const {
    wordId,
    idiomId,
    customTerm,
    customMeaningJa,
    passageId,
    sourceVideoId,
    sourceVideoCueSeq,
    contextSentence,
  } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'UNAUTHENTICATED' };

  // Check for existing row on the relevant key.
  let existingQuery = supabase
    .from('user_vocab')
    .select('id')
    .eq('user_id', user.id)
    .limit(1);
  if (wordId) existingQuery = existingQuery.eq('word_id', wordId);
  else if (idiomId) existingQuery = existingQuery.eq('idiom_id', idiomId);
  else if (customTerm) existingQuery = existingQuery.eq('custom_term', customTerm);

  const { data: existing, error: checkError } = await existingQuery.maybeSingle();
  if (checkError) return { ok: false, error: checkError.message };
  if (existing) return { ok: true, id: existing.id, alreadySaved: true };

  const { data, error } = await supabase
    .from('user_vocab')
    .insert({
      user_id: user.id,
      word_id: wordId ?? null,
      idiom_id: idiomId ?? null,
      custom_term: customTerm ?? null,
      custom_meaning_ja: customMeaningJa ?? null,
      source_passage_id: passageId ?? null,
      // Cast until db:types picks up the new columns from migration 20260419000003.
      ...({
        source_video_id: sourceVideoId ?? null,
        source_video_cue_seq: sourceVideoCueSeq ?? null,
      } as unknown as Record<string, never>),
      context_sentence: contextSentence ?? null,
    })
    .select('id')
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data.id, alreadySaved: false };
}
