-- ============================================================================
-- YouTube subtitle learning feature
-- ============================================================================
-- Adds a shared cache of YouTube videos + their subtitle cues so that
-- approved users can learn vocabulary from videos (tap a word, look up its
-- gloss, save to user_vocab). Videos / cues are treated as a temporary
-- learning-purpose cache. RLS is tightened to approved users for cue text.
--
-- Also extends user_vocab to record which video / cue a saved term came from.
-- ============================================================================

-- 1. Tables --------------------------------------------------------------------

create table if not exists public.videos (
  id           uuid primary key default gen_random_uuid(),
  youtube_id   text unique not null,
  title        text,
  lang         text,
  created_at   timestamptz not null default now()
);

create table if not exists public.video_cues (
  id          uuid primary key default gen_random_uuid(),
  video_id    uuid not null references public.videos(id) on delete cascade,
  seq         integer not null,
  start_ms    integer not null,
  end_ms      integer not null,
  text        text not null,
  unique (video_id, seq)
);

-- 2. user_vocab source columns -------------------------------------------------

alter table public.user_vocab
  add column if not exists source_video_id uuid references public.videos(id) on delete set null;

alter table public.user_vocab
  add column if not exists source_video_cue_seq integer;

-- 3. Indexes -------------------------------------------------------------------

create index if not exists video_cues_video_seq_idx
  on public.video_cues (video_id, seq);

create index if not exists user_vocab_source_video_idx
  on public.user_vocab (user_id, source_video_id)
  where source_video_id is not null;

-- 4. RLS -----------------------------------------------------------------------

alter table public.videos     enable row level security;
alter table public.video_cues enable row level security;

-- videos: authenticated users can read metadata.
drop policy if exists "read videos" on public.videos;
create policy "read videos" on public.videos
  for select to authenticated using (true);

-- video_cues: approved users only (allowlist-gated).
drop policy if exists "read video cues" on public.video_cues;
create policy "read video cues" on public.video_cues
  for select to authenticated using (public.is_approved());

-- Writes are service-role only (no insert/update/delete policies).
