import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';

// Default build: the standalone demo page (index.html) that mounts <AAStarWidget />.
// For the vanilla <script>/iframe embed bundle, see vite.embed.config.ts (pnpm run build:embed).
//
// `@aastar/sdk` is published as a single bundle that includes some Node-oriented code:
// it imports `createRequire` from `module` and reads `process.env.*` for an OPT-IN local
// config loader. None of that runs in the browser path this widget uses, but it must be
// shimmed/defined for a browser build to succeed. The two entries below do exactly that.
const moduleShim = fileURLToPath(new URL('./src/shims/node-module.ts', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Replace Node's `module` builtin with a browser-safe createRequire shim.
      module: moduleShim,
    },
  },
  define: {
    // Neutralize the SDK's `process.env.*` reads so the local-config loader is skipped.
    'process.env': '{}',
  },
});
