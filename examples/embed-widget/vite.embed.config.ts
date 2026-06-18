import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';

// Library build for the vanilla <script> embed.
// Produces a single self-contained IIFE that exposes `window.AAStarWidget.mount(...)`.
// React + ReactDOM are bundled IN so a non-React host page needs nothing else.
//
//   <script src="/aastar-widget.iife.js"></script>
//   <script>AAStarWidget.mount('#aastar-root', { ... })</script>
//
// See README.md "Vanilla / non-React embed". The module shim + process.env define
// mirror vite.config.ts (browser-safety for the @aastar/sdk bundle).
const moduleShim = fileURLToPath(new URL('./src/shims/node-module.ts', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      module: moduleShim,
    },
  },
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
