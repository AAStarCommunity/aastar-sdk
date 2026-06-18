import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';

// `@aastar/sdk` is published as a single bundle that includes some Node-oriented code:
// it imports `createRequire` from `module` and reads `process.env.*` for an OPT-IN local
// config loader. None of that runs in the browser path this site uses, but it must be
// shimmed/defined for a browser build to succeed. See embed-widget for the same setup.
const moduleShim = fileURLToPath(new URL('./src/shims/node-module.ts', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      module: moduleShim,
    },
  },
  define: {
    'process.env': '{}',
  },
});
