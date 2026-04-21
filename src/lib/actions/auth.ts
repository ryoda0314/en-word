'use server';

import { headers } from 'next/headers';
import { z } from 'zod';

import { createSupabaseServerClient } from '@/lib/supabase/server';

const credSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export type AuthResult =
  | { ok: true; needsEmailConfirm?: boolean }
  | { ok: false; error: string };

export async function signInWithPasswordAction(
  input: z.input<typeof credSchema>,
): Promise<AuthResult> {
  const parsed = credSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

const signUpSchema = credSchema.extend({
  locale: z.string().min(1).max(10),
});

export async function signUpWithPasswordAction(
  input: z.input<typeof signUpSchema>,
): Promise<AuthResult> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid' };

  const h = await headers();
  const host = h.get('host') ?? '';
  const proto =
    h.get('x-forwarded-proto') ??
    (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https');
  const emailRedirectTo = `${proto}://${host}/auth/callback?locale=${parsed.data.locale}`;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { emailRedirectTo },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, needsEmailConfirm: !data.session };
}

export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
}
