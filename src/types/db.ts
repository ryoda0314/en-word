import type { Database } from './database';

type Public = Database['public'];

export type VocabStage = Public['Enums']['vocab_stage'];

export type PassageRow = Public['Tables']['passages']['Row'];
export type WordRow = Public['Tables']['words']['Row'];
export type IdiomRow = Public['Tables']['idioms']['Row'];
export type ProfileRow = Public['Tables']['profiles']['Row'];
export type UserVocabRow = Public['Tables']['user_vocab']['Row'];
export type UserVocabInsert = Public['Tables']['user_vocab']['Insert'];
export type UserSentenceRow = Public['Tables']['user_sentences']['Row'];
export type UserPassageProgressRow =
  Public['Tables']['user_passage_progress']['Row'];
export type ReviewEventRow = Public['Tables']['review_events']['Row'];

// NOTE: Hand-written until the YouTube subtitle migration
// (20260419000003_youtube_subtitles.sql) is pushed and `npm run db:types` is
// re-run — then these will also appear in Database['public']['Tables'].
export type VideoRow = {
  id: string;
  youtube_id: string;
  title: string | null;
  lang: string | null;
  created_at: string;
};

export type VideoCueRow = {
  id: string;
  video_id: string;
  seq: number;
  start_ms: number;
  end_ms: number;
  text: string;
};
