import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Library build for the vanilla <script> embed.
// Produces a single self-contained IIFE that exposes `window.AAStarWidget.mount(...)`.
// React + ReactDOM are bundled IN so a non-React host page needs nothing else.
//
//   <script src="/aastar-widget.iife.js"></script>
//   <script>AAStarWidget.mount('#aastar-root', { ... })</script>
//
// See README.md "Vanilla / non-React embed". The `process.env` define mirrors
// vite.config.ts (the SDK reads env vars at module-eval time; browsers have no `process`).
export default defineConfig({
  plugins: [react()],
  define: {
    'process.env': '{"NODE_ENV":"production"}',
  },
  build: {
    outDir: 'dist-embed',
    lib: {
      entry: 'src/embed.tsx',
      name: 'AAStarWidget',
      formats: ['iife'],
      fileName: () => 'aastar-widget.iife.js',
    },
  },
});
