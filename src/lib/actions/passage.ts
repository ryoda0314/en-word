'use server';

import OpenAI from 'openai';
import { z } from 'zod';

import { isApproved } from '@/lib/auth/approval';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';

const PART_VALUES = [
  'TOEFL Reading',
  'TOEIC Part 6',
  'TOEIC Part 7',
  'General',
] as const;
const LEVEL_VALUES = ['B1', 'B2', 'C1', 'C2'] as const;
const LENGTH_VALUES = ['short', 'medium', 'long'] as const;

export const PASSAGE_PART_OPTIONS = PART_VALUES;
export const PASSAGE_LEVEL_OPTIONS = LEVEL_VALUES;
export const PASSAGE_LENGTH_OPTIONS = LENGTH_VALUES;

const inputSchema = z.object({
  topic: z.string().min(3).max(300),
  part: z.enum(PART_VALUES),
  level: z.enum(LEVEL_VALUES),
  length: z.enum(LENGTH_VALUES),
  notes: z.string().max(500).optional(),
});

const aiSchema = z.object({
  title: z.string().min(3).max(120),
  slug: z
    .string()
    .min(3)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  body: z.string().min(100).max(6000),
});

export type GeneratePassageResult =
  | { ok: true; passageId: string; slug: string }
  | {
      ok: false;
      error:
        | 'UNAUTHENTICATED'
        | 'NOT_APPROVED'
        | 'RATE_LIMITED'
        | 'AI_FAILED'
        | 'INVALID'
        | 'DB';
    };

const WORD_COUNTS: Record<(typeof LENGTH_VALUES)[number], number> = {
  short: 180,
  medium: 260,
  long: 380,
};

const SYSTEM_PROMPT = `You write English practice passages for Japanese learners preparing for TOEIC/TOEFL.
The passage must sound natural, match the specified test format, and be approximately the requested length in words (±15%).

Format guide:
- TOEFL Reading: academic prose resembling a short encyclopedia or journal article. 3-4 paragraphs.
- TOEIC Part 6: business documents (email, memo, notice) with clear addressee and purpose. 2-3 paragraphs.
- TOEIC Part 7: longer business/workplace texts (announcement, article, notification) with concrete details. 2-3 paragraphs.
- General: non-fiction in a neutral register.

Rules:
- Separate paragraphs with a single blank line (two newline characters).
- No bullet lists, tables, or markdown. Straight prose only.
- Keep vocabulary within the requested CEFR level; do not pile obscure jargon.
- Make the passage self-contained; avoid references that require outside context.

Generate a slug from the title: lowercase ASCII, 3-8 English words joined by hyphens, no trailing hyphens. The server will append a uniqueness suffix, so do not add one yourself.`;

export async function generatePassage(
  input: z.input<typeof inputSchema>,
): Promise<GeneratePassageResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'INVALID' };
  const { topic, part, level, length, notes } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'UNAUTHENTICATED' };
  if (!(await isApproved(supabase))) {
    return { ok: false, error: 'NOT_APPROVED' };
  }

  const allowed = await checkAndBumpRate(user.id, 'openai.passage', 5);
  if (!allowed) return { ok: false, error: 'RATE_LIMITED' };

  if (!process.env.OPENAI_API_KEY) return { ok: false, error: 'AI_FAILED' };
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const wordTarget = WORD_COUNTS[length];
  const userPrompt = `Topic: ${topic}
Test format: ${part}
CEFR level: ${level}
Target length: approximately ${wordTarget} words
${notes ? `Additional notes: ${notes}` : ''}`;

  let ai: z.infer<typeof aiSchema>;
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.7,
      max_tokens: 1200,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'passage',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              title: { type: 'string' },
              slug: { type: 'string' },
              body: { type: 'string' },
            },
            required: ['title', 'slug', 'body'],
          },
        },
      },
    });
    const raw = completion.choices[0]?.message?.content ?? '{}';
    ai = aiSchema.parse(JSON.parse(raw));
  } catch (err) {
    console.error('generatePassage AI error:', err);
    return { ok: false, error: 'AI_FAILED' };
  }

  const suffix = Math.random().toString(36).slice(2, 6);
  const slug = `${ai.slug}-${suffix}`;
  const wordCount = ai.body.trim().split(/\s+/).length;

  const service = createSupabaseServiceClient();
  const { data: inserted, error } = await service
    .from('passages')
    .insert({
      slug,
      title: ai.title,
      body: ai.body,
      level,
      part,
      source: `ai:${user.id.slice(0, 8)}`,
      language: 'en',
      word_count: wordCount,
    })
    .select('id, slug')
    .single();

  if (error || !inserted) {
    return { ok: false, error: 'DB' };
  }

  return { ok: true, passageId: inserted.id, slug: inserted.slug };
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
