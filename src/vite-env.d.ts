/// <reference types="vite/client" />
/// <reference types="solid-js" />
///// <reference types="solid-styled-jsx/style" />

/**
 * Remote ES modules loaded at runtime through dynamic `import()` with
 * `@vite-ignore` (TypeScript/Wenyan compilers fetched from a CDN). Vite leaves
 * the specifiers alone, so TypeScript has nothing to resolve them against.
 * Callers cast the result to the shape they expect.
 */
declare module 'https://*';

