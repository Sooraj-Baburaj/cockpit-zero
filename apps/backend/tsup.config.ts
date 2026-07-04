import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  clean: true,
  sourcemap: true,
  // Test-only driver (PGlite) behind a dynamic import in src/db/index.ts — it's
  // a devDependency, so keep esbuild from trying to bundle its WASM.
  external: ['@electric-sql/pglite'],
});
