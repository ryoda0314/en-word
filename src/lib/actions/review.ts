'use server';

import { z } from 'zod';

import { applySm2, nextStage, type Sm2State } from '@/lib/srs/sm2';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const schema = z.object({
  userVocabId: z.string().uuid(),
  quality: z.number().int().min(0).max(5),
});

export type SubmitReviewResult =
  | {
      ok: true;
      stageBefore: string;
      stageAfter: string;
      nextReviewAt: string;
      intervalDays: number;
    }
  | { ok: false; error: string };

export async function submitReview(
  input: z.input<typeof schema>,
): Promise<SubmitReviewResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'INVALID' };
  const { userVocabId, quality } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'UNAUTHENTICATED' };

  const { data: vocab, error: fetchError } = await supabase
    .from('user_vocab')
    .select('id, stage, ease, interval_days, repetition, lapses')
    .eq('id', userVocabId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (fetchError || !vocab) return { ok: false, error: 'NOT_FOUND' };

  const state: Sm2State = {
    ease: Number(vocab.ease) || 2.5,
    intervalDays: Number(vocab.interval_days) || 0,
    repetition: Number(vocab.repetition) || 0,
    lapses: Number(vocab.lapses) || 0,
  };
  const sm2 = applySm2(state, quality);
  const stageAfter = nextStage(vocab.stage, quality);

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from('user_vocab')
    .update({
      stage: stageAfter,
      ease: sm2.ease,
      interval_days: sm2.intervalDays,
      repetition: sm2.repetition,
      lapses: sm2.lapses,
      next_review_at: sm2.nextReviewAt.toISOString(),
      last_reviewed_at: now,
    })
    .eq('id', userVocabId)
    .eq('user_id', user.id);
  if (updateError) return { ok: false, error: updateError.message };

  await supabase.from('review_events').insert({
    user_id: user.id,
    user_vocab_id: userVocabId,
    stage_before: vocab.stage,
    stage_after: stageAfter,
    quality,
  });

  return {
    ok: true,
    stageBefore: vocab.stage,
    stageAfter,
    nextReviewAt: sm2.nextReviewAt.toISOString(),
    intervalDays: sm2.intervalDays,
  };
}
