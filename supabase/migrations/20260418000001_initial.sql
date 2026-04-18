-- ============================================================================
-- en-word-book initial schema
-- ============================================================================
-- Applies to a Supabase Postgres project. Safe to run once; subsequent runs
-- will fail on the CREATE statements (use `supabase db push` for diff-based
-- migrations).
--
-- Sections:
--   1. Extensions & enums
--   2. Seed tables (public read, service-role write)
--   3. User tables (own-row access)
--   4. Indexes
--   5. RLS policies
--   6. Auth trigger (auto-create profile)
--   7. Helper functions
-- ============================================================================

-- 1. Extensions & enums --------------------------------------------------------

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'vocab_stage') then
    create type vocab_stage as enum ('memorize', 'recognize', 'produce', 'mastered');
  end if;
end$$;

-- 2. Seed tables ---------------------------------------------------------------

create table if not exists public.passages (
  id              uuid primary key default gen_random_uuid(),
  slug            text unique not null,
  title           text not null,
  body            text not null,
  level           text,
  part            text,
  source          text,
  language        text not null default 'en',
  word_count      integer,
  created_at      timestamptz not null default now()
);

create table if not exists public.words (
  id              uuid primary key default gen_random_uuid(),
  lemma           text unique not null,
  pos             text,
  ipa             text,
  meaning_ja      text,
  meaning_en      text,
  example_en      text,
  example_ja      text,
  frequency_rank  integer,
  created_at      timestamptz not null default now()
);

create table if not exists public.idioms (
  id              uuid primary key default gen_random_uuid(),
  phrase          text unique not null,
  meaning_ja      text,
  meaning_en      text,
  example_en      text,
  example_ja      text,
  created_at      timestamptz not null default now()
);

-- 3. User tables ---------------------------------------------------------------

create table if not exists public.profiles (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  display_name    text,
  ui_locale       text not null default 'ja' check (ui_locale in ('ja', 'en')),
  meaning_locale  text not null default 'ja' check (meaning_locale in ('ja', 'en', 'both')),
  daily_goal      integer not null default 10 check (daily_goal > 0),
  timezone        text not null default 'Asia/Tokyo',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.user_vocab (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  word_id            uuid references public.words(id) on delete set null,
  idiom_id           uuid references public.idioms(id) on delete set null,
  custom_term        text,
  custom_meaning_ja  text,
  stage              vocab_stage not null default 'memorize',
  ease               real not null default 2.5,
  interval_days      real not null default 0,
  repetition         integer not null default 0,
  lapses             integer not null default 0,
  next_review_at     timestamptz not null default now(),
  last_reviewed_at   timestamptz,
  source_passage_id  uuid references public.passages(id) on delete set null,
  context_sentence   text,
  created_at         timestamptz not null default now(),
  -- exactly one of (word_id, idiom_id, custom_term) must be set
  constraint user_vocab_single_target check (
    (word_id is not null)::int + (idiom_id is not null)::int + (custom_term is not null)::int = 1
  )
);

create table if not exists public.user_sentences (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  user_vocab_id      uuid not null references public.user_vocab(id) on delete cascade,
  sentence           text not null,
  grade_grammar      smallint check (grade_grammar between 0 and 5),
  grade_meaning      smallint check (grade_meaning between 0 and 5),
  grade_naturalness  smallint check (grade_naturalness between 0 and 5),
  grade_total        smallint check (grade_total between 0 and 5),
  ai_feedback        text,
  created_at         timestamptz not null default now()
);

create table if not exists public.user_passage_progress (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  passage_id         uuid not null references public.passages(id) on delete cascade,
  last_opened_at     timestamptz not null default now(),
  tapped_positions   integer[] not null default '{}',
  completed          boolean not null default false,
  unique (user_id, passage_id)
);

create table if not exists public.review_events (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  user_vocab_id  uuid not null references public.user_vocab(id) on delete cascade,
  stage_before   vocab_stage not null,
  stage_after    vocab_stage not null,
  quality        smallint check (quality between 0 and 5),
  created_at     timestamptz not null default now()
);

create table if not exists public.user_weaknesses (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  category      text not null,
  miss_count    integer not null default 1,
  last_miss_at  timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  unique (user_id, category)
);

create table if not exists public.rate_limits (
  user_id       uuid not null references auth.users(id) on delete cascade,
  action        text not null,
  window_start  timestamptz not null default date_trunc('minute', now()),
  count         integer not null default 1,
  primary key (user_id, action, window_start)
);

-- 4. Indexes -------------------------------------------------------------------

create index if not exists user_vocab_due_idx
  on public.user_vocab (user_id, next_review_at)
  where stage <> 'mastered';

create index if not exists user_vocab_stage_idx
  on public.user_vocab (user_id, stage);

create unique index if not exists user_vocab_user_word_uniq
  on public.user_vocab (user_id, word_id)
  where word_id is not null;

create unique index if not exists user_vocab_user_idiom_uniq
  on public.user_vocab (user_id, idiom_id)
  where idiom_id is not null;

create index if not exists user_sentences_user_vocab_idx
  on public.user_sentences (user_id, user_vocab_id, created_at desc);

create index if not exists user_passage_progress_recent_idx
  on public.user_passage_progress (user_id, last_opened_at desc);

create index if not exists review_events_user_time_idx
  on public.review_events (user_id, created_at desc);

create index if not exists words_frequency_idx
  on public.words (frequency_rank nulls last);

-- 5. RLS policies --------------------------------------------------------------

-- Seed tables: public read, writes via service role (RLS bypassed by service role).
alter table public.passages enable row level security;
alter table public.words    enable row level security;
alter table public.idioms   enable row level security;

drop policy if exists "read passages" on public.passages;
create policy "read passages" on public.passages for select using (true);

drop policy if exists "read words" on public.words;
create policy "read words" on public.words for select using (true);

drop policy if exists "read idioms" on public.idioms;
create policy "read idioms" on public.idioms for select using (true);

-- User tables: own-row access only.
alter table public.profiles              enable row level security;
alter table public.user_vocab            enable row level security;
alter table public.user_sentences        enable row level security;
alter table public.user_passage_progress enable row level security;
alter table public.review_events         enable row level security;
alter table public.user_weaknesses       enable row level security;
alter table public.rate_limits           enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own vocab" on public.user_vocab;
create policy "own vocab" on public.user_vocab
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own sentences" on public.user_sentences;
create policy "own sentences" on public.user_sentences
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own progress" on public.user_passage_progress;
create policy "own progress" on public.user_passage_progress
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own review events" on public.review_events;
create policy "own review events" on public.review_events
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own weaknesses" on public.user_weaknesses;
create policy "own weaknesses" on public.user_weaknesses
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "read own rate limits" on public.rate_limits;
create policy "read own rate limits" on public.rate_limits
  for select using (user_id = auth.uid());
-- rate_limits writes: service role only.

-- 6. Auth trigger: auto-create profile on new user ----------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(coalesce(new.email, ''), '@', 1)
    )
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill any pre-existing users.
insert into public.profiles (user_id, display_name)
select u.id, coalesce(u.raw_user_meta_data ->> 'full_name', split_part(coalesce(u.email, ''), '@', 1))
from auth.users u
on conflict (user_id) do nothing;

-- 7. Helper functions ----------------------------------------------------------

-- Due reviews for the current user (uses auth.uid()). Security invoker so RLS applies.
create or replace function public.due_reviews(limit_count int default 20)
returns setof public.user_vocab
language sql
stable
security invoker
set search_path = public
as $$
  select *
  from public.user_vocab
  where user_id = auth.uid()
    and stage <> 'mastered'
    and next_review_at <= now()
  order by next_review_at asc
  limit limit_count;
$$;

-- Summary stats for the current user.
create or replace function public.vocab_stats()
returns table (
  total_count         bigint,
  due_today_count     bigint,
  mastered_count      bigint,
  memorize_count      bigint,
  recognize_count     bigint,
  produce_count       bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    count(*)                                                    as total_count,
    count(*) filter (where stage <> 'mastered' and next_review_at <= now()) as due_today_count,
    count(*) filter (where stage = 'mastered')                  as mastered_count,
    count(*) filter (where stage = 'memorize')                  as memorize_count,
    count(*) filter (where stage = 'recognize')                 as recognize_count,
    count(*) filter (where stage = 'produce')                   as produce_count
  from public.user_vocab
  where user_id = auth.uid();
$$;
