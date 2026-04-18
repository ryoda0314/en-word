'use server';

import { z } from 'zod';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';

export type AllowlistEntry = {
  email: string;
  note: string | null;
  created_at: string;
};

async function requireAdmin(): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase.rpc('is_admin' as never);
  return Boolean(data);
}

const addSchema = z.object({
  email: z.string().email().transform((s) => s.toLowerCase().trim()),
  note: z.string().max(200).optional(),
});

export async function addAllowlistEntry(
  input: z.input<typeof addSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'INVALID' };
  }
  if (!(await requireAdmin())) return { ok: false, error: 'NOT_ADMIN' };

  // `allowlist` was added in migration 20260418000002; re-run `npm run db:types`
  // after applying to drop this cast.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createSupabaseServiceClient() as any;
  const { error } = await service.from('allowlist').upsert({
    email: parsed.data.email,
    note: parsed.data.note ?? null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function removeAllowlistEntry(
  email: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!email) return { ok: false, error: 'INVALID' };
  if (!(await requireAdmin())) return { ok: false, error: 'NOT_ADMIN' };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createSupabaseServiceClient() as any;
  const { error } = await service
    .from('allowlist')
    .delete()
    .eq('email', email.toLowerCase());
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
