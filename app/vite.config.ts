import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  base: './',
  build: { target: 'es2020', outDir: 'dist' },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
