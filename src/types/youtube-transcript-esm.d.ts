// youtube-transcript v1.3.0 declares "type":"module" but its `main` entry
// (dist/youtube-transcript.common.js) uses CJS syntax, which is invalid ESM
// in Node.js 24. We import from the ESM dist file directly. This declaration
// re-exports the package types for that subpath so TypeScript is satisfied.
declare module 'youtube-transcript/dist/youtube-transcript.esm.js' {
  export * from 'youtube-transcript';
}
