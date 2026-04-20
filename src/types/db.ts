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
export type VideoRow = Public['Tables']['videos']['Row'];
export type VideoCueRow = Public['Tables']['video_cues']['Row'];
