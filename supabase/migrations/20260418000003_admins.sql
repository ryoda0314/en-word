-- ============================================================================
-- Admin table + is_admin() helper
-- ============================================================================
-- Admins are identified by auth.users.id (UUID) rather than email so the value
-- stays stable even if the account email changes. Admins can manage the
-- allowlist through the in-app admin page.
-- ============================================================================

create table if not exists public.admins (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  note        text,
  created_at  timestamptz not null default now()
);

alter table public.admins enable row level security;
-- Service-role only. No user-facing policies.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins where user_id = auth.uid()
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;

-- Seed: project owner.
insert into public.admins (user_id, note)
values ('0d5df6de-3eeb-4fdf-815d-a8fe982ed4b0', 'project owner')
on conflict (user_id) do nothing;
