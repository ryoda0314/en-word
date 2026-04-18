-- ============================================================================
-- Allowlist-based admin approval gate
-- ============================================================================
-- Only users whose auth email is in public.allowlist may use the app.
-- Everyone else is blocked at the layout level AND in every AI Server Action.
-- ============================================================================

create table if not exists public.allowlist (
  email       text primary key,
  note        text,
  created_at  timestamptz not null default now()
);

-- Service-role only: no SELECT/INSERT/UPDATE policies for authenticated users.
alter table public.allowlist enable row level security;

-- A security-definer helper that returns whether the caller's email is in the
-- allowlist. Bypasses RLS on the allowlist so we don't have to expose it.
create or replace function public.is_approved()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.allowlist
    where email = (auth.jwt() ->> 'email')
  );
$$;

grant execute on function public.is_approved() to anon, authenticated;

-- Seed: approve the project owner.
insert into public.allowlist (email, note)
values ('edamamemochi2004@gmail.com', 'project owner')
on conflict (email) do nothing;
