import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/ext/**'],
    coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        include: ['packages/*/src/**/*.ts'],
        exclude: ['**/index.ts', '**/*.d.ts', '**/types.ts', '**/test/**', '**/*.test.ts']
    }
  },
});
