import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    server: {
      deps: {
        // Force Vitest to inline ESM packages that have subpath export issues
        inline: ['nostr-tools', '@scure/base'],
      },
    },
  },
});
