import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database';

export async function isApproved(
  supabase: SupabaseClient<Database>,
): Promise<boolean> {
  // `is_approved` is defined in migration 20260418000002_allowlist.sql.
  // Re-running `npm run db:types` after the migration lands will let us drop
  // this `as never` cast.
  const { data, error } = await supabase.rpc('is_approved' as never);
  if (error) return false;
  return Boolean(data);
}
