'use server';

import OpenAI from 'openai';
import { z } from 'zod';

import { isApproved } from '@/lib/auth/approval';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';

const inputSchema = z.object({
  userVocabId: z.string().uuid(),
  sentence: z.string().min(1).max(1000),
  targetTerm: z.string().min(1).max(200),
  meaning: z.string().max(500).optional(),
});

const gradeSchema = z.object({
  grammar: z.number().int().min(0).max(5),
  meaning: z.number().int().min(0).max(5),
  naturalness: z.number().int().min(0).max(5),
  total: z.number().int().min(0).max(5),
  feedback_ja: z.string(),
  corrected: z.string(),
});

export type GradeData = z.infer<typeof gradeSchema>;

export type GradeResult =
  | { ok: true; grade: GradeData; sentenceId: string }
  | {
      ok: false;
      error:
        | 'UNAUTHENTICATED'
        | 'NOT_APPROVED'
        | 'RATE_LIMITED'
        | 'AI_FAILED'
        | 'INVALID';
    };

const SYSTEM_PROMPT = `You grade a one-sentence English writing attempt by a Japanese TOEIC/TOEFL learner.
The learner is practicing a specific target term. Grade the sentence on three criteria, each 0-5:
- grammar: syntactic correctness and usage
- meaning: did the sentence use the target term in a way that matches its meaning?
- naturalness: would a native speaker phrase it this way in a typical business or academic context?
Then compute a single "total" 0-5 that summarizes overall quality (weight meaning and grammar slightly higher than naturalness).
Also return:
- feedback_ja: one short, encouraging comment in Japanese (under 120 chars) that names the main improvement (if any), otherwise praises the sentence.
- corrected: a minimally-edited version of the learner's sentence, preserving their intent. If the original is already fine, return the original unchanged.
Return strictly JSON.`;

export async function gradeSentence(
  input: z.input<typeof inputSchema>,
): Promise<GradeResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'INVALID' };
  const { userVocabId, sentence, targetTerm, meaning } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'UNAUTHENTICATED' };
  if (!(await isApproved(supabase))) {
    return { ok: false, error: 'NOT_APPROVED' };
  }

  const allowed = await checkAndBumpRate(user.id, 'openai.grade', 15);
  if (!allowed) return { ok: false, error: 'RATE_LIMITED' };

  if (!process.env.OPENAI_API_KEY) {
    return { ok: false, error: 'AI_FAILED' };
  }
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const userPrompt = `Target term: "${targetTerm}"
Target meaning (Japanese): ${meaning ?? '(none provided)'}
Learner's sentence: ${sentence}`;

  let grade: GradeData;
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      max_tokens: 500,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'grade',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              grammar: { type: 'integer', minimum: 0, maximum: 5 },
              meaning: { type: 'integer', minimum: 0, maximum: 5 },
              naturalness: { type: 'integer', minimum: 0, maximum: 5 },
              total: { type: 'integer', minimum: 0, maximum: 5 },
              feedback_ja: { type: 'string' },
              corrected: { type: 'string' },
            },
            required: [
              'grammar',
              'meaning',
              'naturalness',
              'total',
              'feedback_ja',
              'corrected',
            ],
          },
        },
      },
    });
    const raw = completion.choices[0]?.message?.content ?? '{}';
    grade = gradeSchema.parse(JSON.parse(raw));
  } catch (err) {
    console.error('OpenAI grade failed:', err);
    return { ok: false, error: 'AI_FAILED' };
  }

  const { data: saved, error: insertError } = await supabase
    .from('user_sentences')
    .insert({
      user_id: user.id,
      user_vocab_id: userVocabId,
      sentence,
      grade_grammar: grade.grammar,
      grade_meaning: grade.meaning,
      grade_naturalness: grade.naturalness,
      grade_total: grade.total,
      ai_feedback: grade.feedback_ja + '\n\nCorrected: ' + grade.corrected,
    })
    .select('id')
    .single();
  if (insertError || !saved) {
    return { ok: false, error: 'AI_FAILED' };
  }

  return { ok: true, grade, sentenceId: saved.id };
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
    await service
      .from('rate_limits')
      .insert({ user_id: userId, action, window_start: iso, count: 1 });
  }
  return true;
}
