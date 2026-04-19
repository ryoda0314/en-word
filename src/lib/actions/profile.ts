'use server';

import { z } from 'zod';

import { createSupabaseServerClient } from '@/lib/supabase/server';

const schema = z.object({
  display_name: z.string().max(60).nullable().optional(),
  ui_locale: z.enum(['ja', 'en']).optional(),
  meaning_locale: z.enum(['ja', 'en', 'both']).optional(),
  daily_goal: z.number().int().min(1).max(200).optional(),
  timezone: z.string().max(100).optional(),
});

export type UpdateProfileResult =
  | { ok: true }
  | { ok: false; error: string };

export async function updateProfile(
  input: z.input<typeof schema>,
): Promise<UpdateProfileResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'invalid' };
  }
  if (Object.keys(parsed.data).length === 0) {
    return { ok: true };
  }

  // Normalize display_name: empty/whitespace → null so the DB stores NULL.
  const payload = { ...parsed.data };
  if (payload.display_name !== undefined) {
    const trimmed = payload.display_name?.trim();
    payload.display_name = trimmed && trimmed.length > 0 ? trimmed : null;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'UNAUTHENTICATED' };

  // Upsert so a profile row is created on first save if the auth trigger
  // happened before the migration added the table.
  const { error } = await supabase.from('profiles').upsert(
    {
      user_id: user.id,
      ...payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
