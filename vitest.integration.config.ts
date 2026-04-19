import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
    server: {
      deps: {
        inline: ['nostr-tools', '@scure/base', 'ws', 'better-sqlite3'],
      },
    },
  },
});
