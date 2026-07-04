import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Real Postgres, zero infrastructure: PGlite (in-process, WASM) per worker.
    // Each test file gets a fresh database; test/setup.ts applies migrations.
    env: {
      DATABASE_URL: 'pglite://memory',
      NODE_ENV: 'test',
      BETTER_AUTH_SECRET: 'test-only-secret',
    },
    setupFiles: ['./test/setup.ts'],
    // One test file at a time. Parallel workers (each a PGlite WASM instance +
    // scrypt-hashing sign-ups) starve the CPU enough to trip a better-auth race:
    // sign-up clones the request for `sendVerificationEmail` while the body's
    // tee'd stream is still draining → intermittent 500 ("TypeError: unusable").
    // Single-worker runs never hit it (verified with 30 sequential + 20
    // concurrent sign-ups in one file), so serializing files removes the flake
    // without forking production behavior for tests.
    fileParallelism: false,
  },
});
