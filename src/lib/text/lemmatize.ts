import lemmatizer from 'wink-lemmatizer';

/**
 * Try verb → noun → adjective. Return whichever returns a changed form; fall
 * back to the lowercased input. Good enough for matching dictionary lemmas.
 */
export function lemmatize(word: string): string {
  const lower = word.toLowerCase();
  const tryers: Array<(w: string) => string> = [
    lemmatizer.verb,
    lemmatizer.noun,
    lemmatizer.adjective,
  ];
  for (const fn of tryers) {
    const out = fn(lower);
    if (out && out !== lower) return out;
  }
  return lower;
}
