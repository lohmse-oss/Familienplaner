import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

/** Build-Info: in GitHub Actions aus dem Lauf (passt zur APK), lokal aus Git. */
function git(cmd: string): string {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
}
const run = process.env.GITHUB_RUN_NUMBER ?? '';
const commit = (process.env.GITHUB_SHA ?? git('git rev-parse HEAD')).slice(0, 7) || 'unbekannt';
const version = process.env.VERSION_NAME || (run ? `0.1.${run}` : 'Entwicklung');

export default defineConfig({
  plugins: [preact()],
  base: './',
  build: { target: 'es2020', outDir: 'dist' },
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __BUILD_NO__: JSON.stringify(run || 'lokal'),
    __COMMIT__: JSON.stringify(commit),
    __BUILT_AT__: JSON.stringify(new Date().toISOString()),
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // CI-Schwelle (npm test -- --coverage): Kernlogik in src/core muss abgedeckt bleiben
    coverage: {
      provider: 'v8',
      include: ['src/core/**'],
      thresholds: { statements: 95, lines: 95, functions: 95, branches: 85 },
    },
  },
});
