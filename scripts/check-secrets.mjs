#!/usr/bin/env node
/**
 * Repo-Check: keine Secrets, Debug-Ausgaben oder TODOs im Produktivcode.
 * Scannt app/src und worker/src (ohne Tests und ohne gebündelte Daten).
 * Beendet sich mit Exit 1, wenn etwas gefunden wird.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOTS = ['app/src', 'worker/src'];
const SKIP_DIRS = new Set(['data']);
const SKIP_FILES = /\.test\.ts$/;

const RULES = [
  { name: 'console.log/debugger', re: /\bconsole\.(log|debug|info|warn|error)\s*\(|\bdebugger\b/ },
  { name: 'TODO/FIXME/XXX', re: /\b(TODO|FIXME|XXX)\b/ },
  { name: 'Private Key', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  // lange Token-artige Strings (32+ hex/base64), z. B. versehentlich eingecheckte Keys
  { name: 'möglicher Token (32+ hex/base64)', re: /["'`][A-Za-z0-9+/=]{32,}["'`]/ },
  { name: 'Passwort/Secret hartkodiert', re: /\b(passwort|password|secret|api[_-]?key|token)\b\s*[:=]\s*["'][^"']{6,}["']/i },
];

const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (!SKIP_DIRS.has(name)) walk(p);
    } else if (/\.(ts|tsx|mjs|js|css)$/.test(name) && !SKIP_FILES.test(name)) files.push(p);
  }
};
for (const r of ROOTS) walk(new URL(`../${r}`, import.meta.url).pathname);

let bad = 0;
for (const f of files) {
  const lines = readFileSync(f, 'utf8').split('\n');
  lines.forEach((line, i) => {
    for (const rule of RULES) {
      if (rule.re.test(line)) {
        console.error(`${relative(process.cwd(), f)}:${i + 1}: ${rule.name}: ${line.trim().slice(0, 120)}`);
        bad++;
      }
    }
  });
}
if (bad) {
  console.error(`\n${bad} Verstoß/Verstöße gefunden.`);
  process.exit(1);
}
console.log(`OK: ${files.length} Dateien gescannt, keine Secrets/Debug-Ausgaben/TODOs.`);
