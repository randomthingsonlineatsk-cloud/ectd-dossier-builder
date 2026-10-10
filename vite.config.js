import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the build works from any GitHub Pages path (user.github.io/repo/).
export default defineConfig({
  base: './',
  plugins: [react()],
  // The PDF generator (pdf-lib + fontkit) is a lazily loaded chunk, so its size does not affect first load.
  build: { outDir: 'dist', sourcemap: false, chunkSizeWarningLimit: 800 },
});
