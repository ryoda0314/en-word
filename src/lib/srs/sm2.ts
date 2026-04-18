import type { VocabStage } from '@/types/db';

/**
 * SM-2 (SuperMemo 2) spaced-repetition algorithm, slightly tuned for
 * sub-day recovery on lapses.
 *
 * quality scale:
 *  0 = total blackout
 *  1 = incorrect; the correct one seemed familiar
 *  2 = incorrect; the correct one was easy to recall
 *  3 = correct but difficult
 *  4 = correct with hesitation
 *  5 = perfect recall
 */
export type Sm2State = {
  ease: number;
  intervalDays: number;
  repetition: number;
  lapses: number;
};

export type Sm2Result = Sm2State & {
  nextReviewAt: Date;
};

export function applySm2(
  state: Sm2State,
  quality: number,
  now: Date = new Date(),
): Sm2Result {
  const q = Math.max(0, Math.min(5, Math.round(quality)));
  let { ease, intervalDays, repetition, lapses } = state;

  if (q < 3) {
    // lapse: short recovery delay, reset repetition chain
    repetition = 0;
    intervalDays = 10 / (60 * 24); // 10 minutes
    lapses += 1;
  } else {
    if (repetition === 0) {
      intervalDays = 1;
    } else if (repetition === 1) {
      intervalDays = 3;
    } else {
      intervalDays = Math.max(1, intervalDays * ease);
    }
    repetition += 1;
  }

  const delta = 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02);
  ease = Math.max(1.3, ease + delta);

  const nextReviewAt = new Date(
    now.getTime() + intervalDays * 24 * 60 * 60 * 1000,
  );
  return { ease, intervalDays, repetition, lapses, nextReviewAt };
}

/**
 * Stage progression rule. A passing quality advances one step; a failure
 * keeps the current stage. Reaching 'mastered' requires a high-quality
 * pass at 'produce'.
 */
export function nextStage(current: VocabStage, quality: number): VocabStage {
  if (quality < 3) return current;
  switch (current) {
    case 'memorize':
      return 'recognize';
    case 'recognize':
      return 'produce';
    case 'produce':
      return quality >= 4 ? 'mastered' : 'produce';
    case 'mastered':
      return 'mastered';
  }
}

/** Map AI grade total (0-5) to SM-2 quality (0-5) for produce cards. */
export function gradeToQuality(total: number): number {
  if (total >= 5) return 5;
  if (total >= 4) return 5;
  if (total >= 3) return 4;
  if (total >= 2) return 3;
  return 1;
}
