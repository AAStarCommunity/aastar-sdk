import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Default build: the standalone demo page (index.html) that mounts <AAStarWidget />.
// For the vanilla <script>/iframe embed bundle, see vite.embed.config.ts (pnpm run build:embed).
//
// `@aastar/sdk` reads a few `process.env.*` vars at module-eval time (CHAIN_ID, test
// addresses, …) for its optional config layer. Browsers have no `process`, so we define
// it away — the standard Vite pattern for libraries that read env vars. (The Node-builtin
// `createRequire`/`module` issue was fixed upstream in @aastar/sdk@0.20.6, so the previous
// module shim is no longer needed.)
export default defineConfig({
  plugins: [react()],
  define: {
    'process.env': '{}',
  },
});
