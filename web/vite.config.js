import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/vrc/',
  plugins: [react()],
  server: { proxy: { '/api': 'http://127.0.0.1:8790' } },
  build: { outDir: 'dist' }
});
