// Lädt Feiertage + Schulferien für Sachsen (DE-SN) von openholidaysapi.org
// und schreibt sie als Offline-Stand nach app/src/data/holidays.json
import { writeFileSync } from 'node:fs';

const BASE = 'https://openholidaysapi.org';
const from = process.argv[2] ?? '2026-01-01';
const to = process.argv[3] ?? '2028-12-31';
const q = `countryIsoCode=DE&subdivisionCode=DE-SN&validFrom=${from}&validTo=${to}&languageIsoCode=DE`;

async function get(path) {
  const r = await fetch(`${BASE}/${path}?${q}`);
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  return r.json();
}
const norm = (h) => ({ name: h.name[0].text, start: h.startDate, end: h.endDate, nationwide: !!h.nationwide });

const [pub, school] = await Promise.all([get('PublicHolidays'), get('SchoolHolidays')]);
const out = {
  source: 'openholidaysapi.org (DE-SN)',
  fetchedAt: new Date().toISOString().slice(0, 10),
  holidays: pub.map(norm),
  school: school.map(norm),
};
writeFileSync(new URL('../app/src/data/holidays.json', import.meta.url), JSON.stringify(out, null, 1));
console.log(`${out.holidays.length} Feiertage, ${out.school.length} Ferienblöcke (${from}..${to})`);
