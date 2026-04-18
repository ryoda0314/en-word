declare module 'wink-lemmatizer' {
  export function noun(word: string): string;
  export function verb(word: string): string;
  export function adjective(word: string): string;
  const lemmatizer: {
    noun: (word: string) => string;
    verb: (word: string) => string;
    adjective: (word: string) => string;
  };
  export default lemmatizer;
}
