import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Standalone dev/preview shell. The portable portal lives entirely in src/ (plain React) so YAAA (Next)
// can lift it — nothing here is Vite-specific beyond the dev server.
export default defineConfig({
  plugins: [react()],
  server: { port: 5180 },
});
