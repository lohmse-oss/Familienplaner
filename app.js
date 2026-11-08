'use strict';

const FERIEN_SACHSEN = [
  { name: 'Weihnachtsferien 2026/27', von: '2026-12-23', bis: '2027-01-02' },
  { name: 'Winterferien 2027', von: '2027-02-08', bis: '2027-02-19' },
  { name: 'Osterferien 2027', von: '2027-03-26', bis: '2027-04-02' },
  { name: 'Pfingstferien 2027', von: '2027-05-15', bis: '2027-05-18' },
  { name: 'Sommerferien 2027', von: '2027-07-10', bis: '2027-08-20' },
  { name: 'Herbstferien 2027', von: '2027-10-11', bis: '2027-10-23' },
  { name: 'Weihnachtsferien 2027/28', von: '2027-12-23', bis: '2028-01-01' },
  { name: 'Winterferien 2028', von: '2028-02-14', bis: '2028-02-26' },
  { name: 'Osterferien 2028', von: '2028-04-14', bis: '2028-04-22' },
  { name: 'Pfingstferien 2028', von: '2028-05-26', bis: '2028-05-26' },
  { name: 'Sommerferien 2028', von: '2028-07-22', bis: '2028-09-01' },
  { name: 'Herbstferien 2028', von: '2028-10-23', bis: '2028-11-03' },
  { name: 'Weihnachtsferien 2028/29', von: '2028-12-23', bis: '2029-01-03' },
  { name: 'Winterferien 2029', von: '2029-02-05', bis: '2029-02-16' },
  { name: 'Osterferien 2029', von: '2029-03-29', bis: '2029-04-06' },
  { name: 'Pfingstferien 2029', von: '2029-05-19', bis: '2029-05-22' },
  { name: 'Sommerferien 2029', von: '2029-07-21', bis: '2029-08-31' },
  { name: 'Herbstferien 2029', von: '2029-10-22', bis: '2029-11-02' },
  { name: 'Weihnachtsferien 2029/30', von: '2029-12-22', bis: '2030-01-04' },
  { name: 'Winterferien 2030', von: '2030-02-18', bis: '2030-03-01' },
  { name: 'Osterferien 2030', von: '2030-04-19', bis: '2030-04-26' },
  { name: 'Pfingstferien 2030', von: '2030-06-08', bis: '2030-06-11' },
  { name: 'Unterrichtsfreier Tag 2030', von: '2030-05-31', bis: '2030-05-31' },
  { name: 'Sommerferien 2030', von: '2030-07-13', bis: '2030-08-23' }
];

const JAHR_MIN = 2027;
const JAHR_MAX = 2031;

const TYP_LABEL = {
  urlaub: 'Urlaub',
  schulfrei: 'Schulfrei (flexibel)',
  termin: 'Besonderer Tag / Termin',
  abwesenheit: 'Abwesenheit'
};

const MONATSNAMEN = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const WOCHENTAG_KURZ = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

const STORAGE_KEY = 'familienplaner.v1';

let state = null;
let gcalToken = null;
let gcalCalendarId = null;

function pad(n) { return String(n).padStart(2, '0'); }

function toKey(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

function fromKey(k) {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDaysKey(k, n) {
  const d = fromKey(k);
  d.setDate(d.getDate() + n);
  return toKey(d);
}

function daysBetween(a, b) {
  return Math.round((fromKey(b) - fromKey(a)) / 86400000) + 1;
}

function isWerktag(k) {
  const dow = fromKey(k).getDay();
  return dow >= 1 && dow <= 5;
}

function ostern(jahr) {
  const a = jahr % 19;
  const b = Math.floor(jahr / 100);
  const c = jahr % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const monat = Math.floor((h + l - 7 * m + 114) / 31);
  const tag = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(jahr, monat - 1, tag);
}

function bussUndBettag(jahr) {
  for (let tag = 16; tag <= 22; tag++) {
    const d = new Date(jahr, 10, tag);
    if (d.getDay() === 3) return d;
  }
  return null;
}

function feiertageSachsen(jahr, mitFronleichnam) {
  const e = ostern(jahr);
  const liste = [];
  const push = (d, name) => liste.push({ key: toKey(d), name });
  push(new Date(jahr, 0, 1), 'Neujahr');
  push(new Date(e.getFullYear(), e.getMonth(), e.getDate() - 2), 'Karfreitag');
  push(new Date(e.getFullYear(), e.getMonth(), e.getDate() + 1), 'Ostermontag');
  push(new Date(jahr, 4, 1), 'Tag der Arbeit');
  push(new Date(e.getFullYear(), e.getMonth(), e.getDate() + 39), 'Christi Himmelfahrt');
  push(new Date(e.getFullYear(), e.getMonth(), e.getDate() + 50), 'Pfingstmontag');
  if (mitFronleichnam) push(new Date(e.getFullYear(), e.getMonth(), e.getDate() + 60), 'Fronleichnam (regional, sorbische Gemeinden)');
  push(new Date(jahr, 9, 3), 'Tag der Deutschen Einheit');
  push(new Date(jahr, 9, 31), 'Reformationstag');
  const bb = bussUndBettag(jahr);
  if (bb) push(bb, 'Buß- und Bettag');
  push(new Date(jahr, 11, 25), '1. Weihnachtstag');
  push(new Date(jahr, 11, 26), '2. Weihnachtstag');
  return liste;
}

function feiertagMap(jahr, mitFronleichnam) {
  const map = {};
  for (const f of feiertageSachsen(jahr, mitFronleichnam)) map[f.key] = f.name;
  return map;
}

function hatWerktagZwischen(a, b, fmap) {
  for (let k = addDaysKey(a, 1); k < b; k = addDaysKey(k, 1)) {
    if (isWerktag(k) && !fmap[k]) return true;
  }
  return false;
}

function mergeBloecke(ranges, fmap) {
  const sortiert = ranges.slice().sort((x, y) => x.von < y.von ? -1 : 1);
  const merged = [];
  for (const r of sortiert) {
    const last = merged[merged.length - 1];
    if (last && !hatWerktagZwischen(last.bis, r.von, fmap)) {
      if (r.bis > last.bis) last.bis = r.bis;
    } else {
      merged.push({ von: r.von, bis: r.bis });
    }
  }
  return merged;
}

function bloeckeFor(mitgliedId, typ, jahr) {
  const fmap = feiertagMap(jahr, state.einstellungen?.fronleichnamRegional === true);
  const jahrStart = `${jahr}-01-01`;
  const jahrEnde = `${jahr}-12-31`;
  const ranges = state.eintraege
    .filter(e => e.mitgliedId === mitgliedId && e.typ === typ && e.von <= jahrEnde && e.bis >= jahrStart)
    .map(e => ({ von: e.von < jahrStart ? jahrStart : e.von, bis: e.bis > jahrEnde ? jahrEnde : e.bis }));
  return mergeBloecke(ranges, fmap).map(b => ({
    ...b,
    kalendertage: daysBetween(b.von, b.bis),
    urlaubstage: urlaubstageImJahr(b, jahr, fmap),
    ferien: ferienIn(b.von, b.bis)
  }));
}

function ferienIn(von, bis) {
  const namen = [];
  for (const f of alleFerien()) {
    if (f.bis >= von && f.von <= bis && !namen.includes(f.name)) namen.push(f.name);
  }
  return namen;
}

function renderUrlaubsliste() {
  const jahr = state.jahr;
  const box = document.getElementById('listeInhalt');
  let html = `<p class="hint">Zusammenhängende Blöcke: Zeiträume, zwischen denen kein Arbeitstag liegt (nur Wochenende/Feiertage dazwischen), werden zu einem Urlaubsblock zusammengefasst. 24.12./31.12. zählen als ½ Tag.</p>`;
  for (const m of state.mitglieder) {
    if (m.rolle === 'elternteil') {
      const bloecke = bloeckeFor(m.id, 'urlaub', jahr);
      const gesamt = bloecke.reduce((s, b) => s + b.urlaubstage, 0);
      html += `<div class="liste-karte" style="border-top:4px solid ${m.farbe}">
        <h3>${esc(m.name)} – Urlaub ${jahr}</h3>
        <div class="liste-summe">${gesamt} von ${Number(m.urlaubstage) || 0} Urlaubstagen verbraucht (${(Number(m.urlaubstage) || 0) - gesamt} übrig)</div>`;
      if (!bloecke.length) html += '<p>Noch kein Urlaub eingetragen.</p>';
      for (const b of bloecke) {
        html += `<div class="liste-zeile">
          <strong>${fmtDeutsch(b.von)} – ${fmtDeutsch(b.bis)}</strong>
          <span>${b.kalendertage} Kalendertage · <strong>${b.urlaubstage} Urlaubstage</strong></span>
          ${b.ferien.length ? `<span class="badge ferien-b">${esc(b.ferien.join(', '))}</span>` : ''}
        </div>`;
      }
      html += '</div>';
    } else {
      const bloecke = bloeckeFor(m.id, 'schulfrei', jahr);
      if (!bloecke.length) continue;
      html += `<div class="liste-karte" style="border-top:4px solid ${m.farbe}">
        <h3>${esc(m.name)} – flexible schulfreie Tage ${jahr}</h3>`;
      for (const b of bloecke) {
        html += `<div class="liste-zeile"><strong>${fmtDeutsch(b.von)} – ${fmtDeutsch(b.bis)}</strong> <span>${b.kalendertage} Kalendertage</span></div>`;
      }
      html += '</div>';
    }
  }
  box.innerHTML = html;
}

function istHalbtag(key, jahr) {
  return key === `${jahr}-12-24` || key === `${jahr}-12-31`;
}

function urlaubstageImJahr(e, jahr, fmap) {
  const jahrStart = `${jahr}-01-01`;
  const jahrEnde = `${jahr}-12-31`;
  const von = e.von < jahrStart ? jahrStart : e.von;
  const bis = e.bis > jahrEnde ? jahrEnde : e.bis;
  let count = 0;
  for (let k = von; k <= bis; k = addDaysKey(k, 1)) {
    if (isWerktag(k) && !fmap[k]) count += istHalbtag(k, jahr) ? 0.5 : 1;
  }
  return count;
}

function isoKW(key) {
  const d = fromKey(key);
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const fd = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - fd + 3);
  return 1 + Math.round((date - firstThursday) / (7 * 86400000));
}

function alleFerien() {
  return FERIEN_SACHSEN.concat(state.eigeneFerien || []);
}

function ferienAm(key) {
  const namen = [];
  for (const f of alleFerien()) {
    if (key >= f.von && key <= f.bis) namen.push(f.name);
  }
  return namen;
}

function istFerienTag(key) { return ferienAm(key).length > 0; }

function urlaubVerbraucht(mitgliedId, jahr) {
  const fmap = feiertagMap(jahr, state.einstellungen?.fronleichnamRegional === true);
  let sum = 0;
  for (const e of state.eintraege) {
    if (e.mitgliedId === mitgliedId && e.typ === 'urlaub' && e.von <= `${jahr}-12-31` && e.bis >= `${jahr}-01-01`) {
      sum += urlaubstageImJahr(e, jahr, fmap);
    }
  }
  return sum;
}

function schulfreieTageKind(mitgliedId, jahr) {
  const fmap = feiertagMap(jahr, state.einstellungen?.fronleichnamRegional === true);
  const tage = new Set();
  const jahrStart = `${jahr}-01-01`;
  const jahrEnde = `${jahr}-12-31`;
  for (const f of alleFerien()) {
    const von = f.von < jahrStart ? jahrStart : f.von;
    const bis = f.bis > jahrEnde ? jahrEnde : f.bis;
    for (let k = von; k <= bis; k = addDaysKey(k, 1)) tage.add(k);
  }
  for (const k in fmap) {
    if (k >= jahrStart && k <= jahrEnde) tage.add(k);
  }
  for (const e of state.eintraege) {
    if (e.mitgliedId === mitgliedId && e.typ === 'schulfrei') {
      const von = e.von < jahrStart ? jahrStart : e.von;
      const bis = e.bis > jahrEnde ? jahrEnde : e.bis;
      for (let k = von; k <= bis; k = addDaysKey(k, 1)) tage.add(k);
    }
  }
  return tage.size;
}

function eintraegeAm(key) {
  return state.eintraege.filter(e => key >= e.von && key <= e.bis);
}

function mitgliedById(id) {
  return state.mitglieder.find(m => m.id === id);
}

function defaultState() {
  return {
    version: 1,
    ansicht: 'monate',
    wandMitglied: 'm1',
    jahr: Math.min(Math.max(new Date().getFullYear(), JAHR_MIN), JAHR_MAX),
    mitglieder: [
      { id: 'm1', name: 'Elternteil 1', rolle: 'elternteil', farbe: '#2563eb', urlaubstage: 30 },
      { id: 'm2', name: 'Elternteil 2', rolle: 'elternteil', farbe: '#db2777', urlaubstage: 30 },
      { id: 'm3', name: 'Kind 1', rolle: 'kind', farbe: '#16a34a' },
      { id: 'm4', name: 'Kind 2', rolle: 'kind', farbe: '#d97706' }
    ],
    eintraege: [],
    eigeneFerien: [],
    einstellungen: { fronleichnamRegional: false, gcalClientId: '' }
  };
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('Speichern im Browser fehlgeschlagen', err);
  }
}

function normalizeState() {
  state.ansicht = state.ansicht || 'monate';
  state.wandMitglied = state.wandMitglied || (state.mitglieder[0] && state.mitglieder[0].id);
  state.einstellungen = state.einstellungen || { fronleichnamRegional: false, gcalClientId: '' };
  state.eigeneFerien = state.eigeneFerien || [];
}

async function load() {
  try {
    const res = await fetch('data.json', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        state = Object.assign(defaultState(), data);
        normalizeState();
        save();
        return;
      }
      state = JSON.parse(stored);
      normalizeState();
      return;
    }
  } catch (err) {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      state = JSON.parse(stored);
      normalizeState();
      return;
    }
  }
  state = defaultState();
  normalizeState();
  save();
}

function uid() {
  return 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function fmtDeutsch(k) {
  const d = fromKey(k);
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderUebersicht() {
  const jahr = state.jahr;
  const box = document.getElementById('uebersicht');
  let html = '';
  for (const m of state.mitglieder) {
    if (m.rolle === 'elternteil') {
      const verbraucht = urlaubVerbraucht(m.id, jahr);
      const verfuegbar = Number(m.urlaubstage) || 0;
      const rest = verfuegbar - verbraucht;
      const klasse = rest < 0 ? 'warn' : '';
      html += `<div class="karte ${klasse}" style="border-top:4px solid ${m.farbe}">
        <strong>${esc(m.name)}</strong> (Urlaub)<br>
        <span class="zahl">${verbraucht}</span> von ${verfuegbar} Tagen verbraucht –
        <strong>${rest >= 0 ? rest + ' übrig' : Math.abs(rest) + ' zu viel'}</strong>
      </div>`;
    } else {
      const frei = schulfreieTageKind(m.id, jahr);
      html += `<div class="karte" style="border-top:4px solid ${m.farbe}">
        <strong>${esc(m.name)}</strong> (schulfrei)<br>
        <span class="zahl">${frei}</span> schulfreie Tage in ${jahr}
      </div>`;
    }
  }
  box.innerHTML = html;
}

function renderJahrSelect() {
  const sel = document.getElementById('jahrSelect');
  let html = '';
  for (let j = JAHR_MIN; j <= JAHR_MAX; j++) {
    html += `<option value="${j}" ${j === state.jahr ? 'selected' : ''}>${j}</option>`;
  }
  sel.innerHTML = html;
}

function renderKalender() {
  const jahr = state.jahr;
  const fmap = feiertagMap(jahr, state.einstellungen?.fronleichnamRegional === true);
  const grid = document.getElementById('monate');
  let html = '';
  for (let monat = 0; monat < 12; monat++) {
    const erster = new Date(jahr, monat, 1);
    const tageImMonat = new Date(jahr, monat + 1, 0).getDate();
    let tage = '';
    const startDow = (erster.getDay() + 6) % 7;
    for (let i = 0; i < startDow; i++) tage += '<div class="tag leer"></div>';
    for (let tag = 1; tag <= tageImMonat; tag++) {
      const key = `${jahr}-${pad(monat + 1)}-${pad(tag)}`;
      const ferien = ferienAm(key);
      const feiertag = fmap[key];
      const eintraege = eintraegeAm(key);
      const schulfrei = eintraege.some(e => e.typ === 'schulfrei');
      let cls = 'tag';
      if (ferien.length) cls += ' ferien';
      if (feiertag) cls += ' feiertag';
      if (schulfrei) cls += ' schulfrei';
      if (istHalbtag(key, jahr)) cls += ' halbtag';
      let titel = [];
      if (ferien.length) titel.push('Ferien: ' + ferien.join(', '));
      if (feiertag) titel.push('Feiertag: ' + feiertag);
      if (istHalbtag(key, jahr)) titel.push('Halber Tag (½ Urlaubstag)');
      for (const e of eintraege) {
        const m = mitgliedById(e.mitgliedId);
        titel.push(`${m ? m.name : '?'}: ${TYP_LABEL[e.typ]}${e.titel ? ' – ' + e.titel : ''}`);
      }
      let chips = '';
      for (const e of eintraege) {
        const m = mitgliedById(e.mitgliedId);
        chips += `<span class="chip typ-${e.typ}" style="background:${m ? m.farbe : '#666'}" title="${esc(titel.filter(t => t.includes(TYP_LABEL[e.typ])).join('\n'))}"></span>`;
      }
      tage += `<div class="${cls}" data-key="${key}" title="${esc(titel.join('\n'))}"><span class="nr">${tag}</span>${feiertag ? `<span class="ft">${esc(feiertag)}</span>` : ''}${chips}</div>`;
    }
    html += `<div class="monat"><h3>${MONATSNAMEN[monat]} ${jahr}</h3>
      <div class="wochentage">${WOCHENTAG_KURZ.map(w => `<span>${w}</span>`).join('')}</div>
      <div class="tage">${tage}</div></div>`;
  }
  grid.innerHTML = html;
  grid.querySelectorAll('.tag[data-key]').forEach(el => {
    el.addEventListener('click', () => openTagModal(el.dataset.key));
  });
}

let auswahl = new Set();
let auswahlAnker = null;

function toggleAuswahl(key, ev) {
  if (ev.shiftKey && auswahlAnker) {
    const [s, e] = auswahlAnker <= key ? [auswahlAnker, key] : [key, auswahlAnker];
    for (let k = s; k <= e; k = addDaysKey(k, 1)) auswahl.add(k);
  } else {
    if (auswahl.has(key)) auswahl.delete(key); else auswahl.add(key);
    auswahlAnker = key;
  }
  renderWandkalender();
}

function updateAuswahlBar() {
  const info = document.getElementById('auswahlInfo');
  if (info) info.textContent = `${auswahl.size} Tag${auswahl.size === 1 ? '' : 'e'} ausgewählt`;
  const m = mitgliedById(state.wandMitglied);
  const bU = document.getElementById('markUrlaub');
  const bS = document.getElementById('markSchulfrei');
  if (bU) bU.style.display = m && m.rolle === 'elternteil' ? '' : 'none';
  if (bS) bS.style.display = m && m.rolle === 'kind' ? '' : 'none';
}

function markiereAuswahl(typ) {
  const keys = [...auswahl].sort();
  if (!keys.length) { alert('Bitte zuerst Tage auswählen (Klick = einzelner Tag, Shift+Klick = Bereich).'); return; }
  const m = mitgliedById(state.wandMitglied);
  if (!m) return;
  if (typ === 'urlaub' && m.rolle !== 'elternteil') { alert('Urlaub kann nur für Elternteile eingetragen werden.'); return; }
  if (typ === 'schulfrei' && m.rolle !== 'kind') { alert('Schulfreie Tage werden für Kinder eingetragen.'); return; }
  const nurArbeitstage = document.getElementById('nurArbeitstage') && document.getElementById('nurArbeitstage').checked;
  const jahr = state.jahr;
  const fmap = feiertagMap(jahr, state.einstellungen?.fronleichnamRegional === true);
  const segmente = [];
  if (typ === 'urlaub' && nurArbeitstage) {
    let segStart = null, prev = null;
    const flush = () => { if (segStart) segmente.push({ von: segStart, bis: prev }); segStart = null; };
    for (const k of keys) {
      if (isWerktag(k) && !fmap[k]) { if (!segStart) segStart = k; prev = k; } else flush();
    }
    flush();
  } else {
    segmente.push({ von: keys[0], bis: keys[keys.length - 1] });
  }
  for (const seg of segmente) {
    const e = { id: uid(), mitgliedId: m.id, typ, von: seg.von, bis: seg.bis, titel: '', notiz: '' };
    state.eintraege.push(e);
    if (gcalToken && gcalCalendarId) gcalUpsert(e);
  }
  auswahl.clear();
  auswahlAnker = null;
  save();
  render();
}

function renderWandkalender() {
  const jahr = state.jahr;
  const fmap = feiertagMap(jahr, state.einstellungen?.fronleichnamRegional === true);
  const m = mitgliedById(state.wandMitglied) || state.mitglieder[0];
  if (state.wandMitglied !== m.id) state.wandMitglied = m.id;
  const sel = document.getElementById('selectWandMitglied');
  if (sel) {
    sel.innerHTML = state.mitglieder.map(x => `<option value="${x.id}" ${x.id === m.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
  }
  const wrap = document.getElementById('wandliste');
  let html = '';
  for (let monat = 0; monat < 12; monat++) {
    html += `<h3 class="wand-monat" id="monat-${monat + 1}">${MONATSNAMEN[monat]} ${jahr}</h3>`;
    const tageImMonat = new Date(jahr, monat + 1, 0).getDate();
    for (let tag = 1; tag <= tageImMonat; tag++) {
      const key = `${jahr}-${pad(monat + 1)}-${pad(tag)}`;
      const d = fromKey(key);
      const dow = (d.getDay() + 6) % 7;
      const feiertag = fmap[key];
      const ferien = ferienAm(key);
      const wochenende = dow >= 5;
      const halb = istHalbtag(key, jahr);
      const entries = eintraegeAm(key).filter(e => e.mitgliedId === m.id);
      let cls = 'tag-zeile';
      if (wochenende) cls += ' wochenende';
      if (feiertag) cls += ' feiertag';
      if (ferien.length) cls += ' ferien';
      if (halb) cls += ' halbtag';
      if (auswahl.has(key)) cls += ' ausgewaehlt';
      let badges = '';
      if (feiertag) badges += `<span class="badge feiertag-b">${esc(feiertag)}</span>`;
      for (const f of ferien) badges += `<span class="badge ferien-b">${esc(f)}</span>`;
      if (halb) badges += `<span class="badge halb-b" title="Halber Arbeitstag (zählt als 0,5 Urlaubstag)">½</span>`;
      let chips = '';
      for (const e of entries) chips += `<span class="chip-e typ-${e.typ}" style="background:${m.farbe}" title="${esc(TYP_LABEL[e.typ] + (e.titel ? ' – ' + e.titel : ''))}">${esc(TYP_LABEL[e.typ])}${e.titel ? ': ' + esc(e.titel) : ''}</span>`;
      html += `<div class="${cls}" id="tag-${key}" data-key="${key}" title="Klick: auswählen · Shift+Klick: Bereich · Doppelklick: Details">
        <span class="datum">${WOCHENTAG_KURZ[dow]} ${pad(tag)}.${pad(monat + 1)}.</span>
        <span class="kw">KW ${isoKW(key)}</span>
        <span class="badges">${badges}</span>
        <span class="echips">${chips}</span>
      </div>`;
    }
  }
  wrap.innerHTML = html;
  wrap.querySelectorAll('.tag-zeile').forEach(el => {
    el.addEventListener('click', (ev) => {
      if (ev.target.closest('.chip-e')) { openTagModal(el.dataset.key); return; }
      toggleAuswahl(el.dataset.key, ev);
    });
    el.addEventListener('dblclick', () => openTagModal(el.dataset.key));
  });
  updateAuswahlBar();
}

function jumpMonat(monat) {
  const el = document.getElementById('monat-' + monat);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function jumpKW(kw) {
  const jahr = state.jahr;
  const ziel = Number(kw);
  if (!ziel) return;
  for (let k = `${jahr}-01-01`; k <= `${jahr}-12-31`; k = addDaysKey(k, 1)) {
    if (isoKW(k) === ziel) {
      const el = document.getElementById('tag-' + k);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
  }
  alert(`KW ${ziel} nicht in ${jahr} gefunden.`);
}

function jumpDatum(d) {
  if (!d) return;
  const el = document.getElementById('tag-' + d);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  else alert('Datum liegt nicht im gewählten Jahr.');
}

function render() {
  renderJahrSelect();
  renderUebersicht();
  const monate = document.getElementById('monate');
  const wand = document.getElementById('wandkalender');
  const liste = document.getElementById('urlaubsliste');
  if (state.ansicht === 'wand') {
    monate.style.display = 'none';
    wand.style.display = 'block';
    liste.style.display = 'none';
    renderWandkalender();
  } else if (state.ansicht === 'liste') {
    monate.style.display = 'none';
    wand.style.display = 'none';
    liste.style.display = 'block';
    renderUrlaubsliste();
  } else {
    monate.style.display = 'grid';
    wand.style.display = 'none';
    liste.style.display = 'none';
    renderKalender();
  }
}

function openModal(id) {
  document.getElementById(id).classList.add('offen');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('offen');
}

function openTagModal(key) {
  const jahr = state.jahr;
  const fmap = feiertagMap(jahr, state.einstellungen?.fronleichnamRegional === true);
  const ferien = ferienAm(key);
  const feiertag = fmap[key];
  const eintraege = eintraegeAm(key);
  let html = `<h3>${fmtDeutsch(key)}</h3>`;
  if (ferien.length) html += `<p class="ferien-text">🏖 ${esc(ferien.join(', '))}</p>`;
  if (feiertag) html += `<p class="feiertag-text">🎌 ${esc(feiertag)}</p>`;
  if (!eintraege.length && !ferien.length && !feiertag) html += '<p>Keine Einträge.</p>';
  for (const e of eintraege) {
    const m = mitgliedById(e.mitgliedId);
    html += `<div class="eintrag-zeile" style="border-left:4px solid ${m ? m.farbe : '#666'}">
      <div><strong>${esc(m ? m.name : '?')}</strong> · ${esc(TYP_LABEL[e.typ])}<br>
      <strong>${esc(e.titel || '–')}</strong><br>
      <small>${fmtDeutsch(e.von)} – ${fmtDeutsch(e.bis)}${e.typ === 'urlaub' ? ` (${urlaubstageImJahr(e, state.jahr, fmap)} Urlaubstage in ${state.jahr})` : ''}</small>
      ${e.notiz ? `<br><small>${esc(e.notiz)}</small>` : ''}</div>
      <button class="loeschen" data-id="${e.id}">Löschen</button>
    </div>`;
  }
  html += `<button id="tagNeuBtn" data-key="${key}">+ Eintrag an diesem Tag</button>`;
  const body = document.getElementById('tagModalBody');
  body.innerHTML = html;
  body.querySelectorAll('.loeschen').forEach(b => b.addEventListener('click', () => {
    const id = b.dataset.id;
    const e = state.eintraege.find(x => x.id === id);
    state.eintraege = state.eintraege.filter(x => x.id !== id);
    if (e && e.gcalId && gcalToken && gcalCalendarId) gcalDelete(e.gcalId);
    save(); render(); closeModal('tagModal');
  }));
  const neuBtn = document.getElementById('tagNeuBtn');
  if (neuBtn) neuBtn.addEventListener('click', () => {
    closeModal('tagModal');
    openEintragModal(neuBtn.dataset.key);
  });
  openModal('tagModal');
}

function fillMitgliederSelect(sel, rolleFilter) {
  sel.innerHTML = state.mitglieder
    .filter(m => !rolleFilter || m.rolle === rolleFilter || rolleFilter === 'alle')
    .map(m => `<option value="${m.id}">${esc(m.name)} (${m.rolle === 'elternteil' ? 'Elternteil' : 'Kind'})</option>`)
    .join('');
}

function openEintragModal(voreingestelltKey) {
  const selTyp = document.getElementById('eTyp');
  selTyp.innerHTML = Object.entries(TYP_LABEL).map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
  fillMitgliederSelect(document.getElementById('eMitglied'), 'alle');
  document.getElementById('eVon').value = voreingestelltKey || toKey(new Date());
  document.getElementById('eBis').value = voreingestelltKey || toKey(new Date());
  document.getElementById('eTitel').value = '';
  document.getElementById('eNotiz').value = '';
  openModal('eintragModal');
}

function submitEintrag() {
  const mitgliedId = document.getElementById('eMitglied').value;
  const typ = document.getElementById('eTyp').value;
  let von = document.getElementById('eVon').value;
  let bis = document.getElementById('eBis').value;
  const titel = document.getElementById('eTitel').value.trim();
  const notiz = document.getElementById('eNotiz').value.trim();
  if (!von) { alert('Bitte Startdatum angeben.'); return; }
  if (!bis || bis < von) bis = von;
  const m = mitgliedById(mitgliedId);
  if (typ === 'urlaub' && m.rolle !== 'elternteil') { alert('Urlaub kann nur für Elternteile eingetragen werden.'); return; }
  if (typ === 'schulfrei' && m.rolle !== 'kind') { alert('Schulfreie Tage werden für Kinder eingetragen.'); return; }
  const e = { id: uid(), mitgliedId, typ, von, bis, titel, notiz };
  state.eintraege.push(e);
  save(); render(); closeModal('eintragModal');
  if (gcalToken && gcalCalendarId) gcalUpsert(e);
}

function renderEinstellungen() {
  const box = document.getElementById('einstellungenListe');
  let html = '';
  state.mitglieder.forEach((m, i) => {
    html += `<div class="mit-row">
      <input type="color" value="${m.farbe}" data-farbe="${m.id}">
      <input type="text" value="${esc(m.name)}" data-name="${m.id}">
      <select data-rolle="${m.id}">
        <option value="elternteil" ${m.rolle === 'elternteil' ? 'selected' : ''}>Elternteil</option>
        <option value="kind" ${m.rolle === 'kind' ? 'selected' : ''}>Kind</option>
      </select>
      ${m.rolle === 'elternteil' ? `<input type="number" min="0" max="60" value="${m.urlaubstage ?? 30}" data-urlaub="${m.id}" title="Verfügbare Urlaubstage" style="width:70px"> Tage` : ''}
    </div>`;
  });
  const ef = state.eigeneFerien || [];
  html += `<h4>Schulferien manuell ergänzen (z. B. 2030 Herbst/Weihnachten, 2031 – sobald veröffentlicht)</h4>`;
  if (!ef.length) html += '<p>Noch keine eigenen Ferien hinterlegt.</p>';
  for (const f of ef) {
    html += `<div class="mit-row"><span>${esc(f.name)}</span> <small>${fmtDeutsch(f.von)} – ${fmtDeutsch(f.bis)}</small> <button class="loeschen" data-ferie="${esc(f.von + '|' + f.name)}">Löschen</button></div>`;
  }
  html += `<div class="mit-row">
    <input type="text" id="efName" placeholder="Name (z. B. Herbstferien 2030)">
    <input type="date" id="efVon"><input type="date" id="efBis">
    <button id="efAdd">Ferien hinzufügen</button>
  </div>`;
  html += `<h4>Sonstiges</h4>
    <label><input type="checkbox" id="efFronleichnam" ${state.einstellungen?.fronleichnamRegional ? 'checked' : ''}> Fronleichnam als Feiertag anzeigen (nur sorbische Gemeinden in Sachsen)</label>
    <label>Google Client-ID (OAuth, aus Google Cloud Console):
      <input type="text" id="gcalClientId" value="${esc(state.einstellungen?.gcalClientId || '')}" placeholder="xxx.apps.googleusercontent.com" style="width:100%"></label>`;
  box.innerHTML = html;
  box.querySelectorAll('[data-name]').forEach(inp => inp.addEventListener('change', () => {
    mitgliedById(inp.dataset.name).name = inp.value; save(); render();
  }));
  box.querySelectorAll('[data-farbe]').forEach(inp => inp.addEventListener('change', () => {
    mitgliedById(inp.dataset.farbe).farbe = inp.value; save(); render();
  }));
  box.querySelectorAll('[data-rolle]').forEach(sel => sel.addEventListener('change', () => {
    mitgliedById(sel.dataset.rolle).rolle = sel.value; save(); render(); renderEinstellungen();
  }));
  box.querySelectorAll('[data-urlaub]').forEach(inp => inp.addEventListener('change', () => {
    mitgliedById(inp.dataset.urlaub).urlaubstage = Number(inp.value); save(); render();
  }));
  box.querySelectorAll('[data-ferie]').forEach(b => b.addEventListener('click', () => {
    const [von, name] = b.dataset.ferie.split('|');
    state.eigeneFerien = state.eigeneFerien.filter(f => !(f.von === von && f.name === name));
    save(); render(); renderEinstellungen();
  }));
  document.getElementById('efAdd').addEventListener('click', () => {
    const name = document.getElementById('efName').value.trim();
    const von = document.getElementById('efVon').value;
    const bis = document.getElementById('efBis').value;
    if (!name || !von || !bis || bis < von) { alert('Name, Start und Ende (gültiger Zeitraum) angeben.'); return; }
    state.eigeneFerien.push({ name, von, bis });
    save(); render(); renderEinstellungen();
  });
  document.getElementById('efFronleichnam').addEventListener('change', (ev) => {
    state.einstellungen.fronleichnamRegional = ev.target.checked; save(); render();
  });
  document.getElementById('gcalClientId').addEventListener('change', (ev) => {
    state.einstellungen.gcalClientId = ev.target.value.trim(); save();
  });
}

function exportJson() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `familienplaner-${state.jahr}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function importJson(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data.mitglieder || !Array.isArray(data.eintraege)) throw new Error('ungültig');
      state = data;
      state.einstellungen = state.einstellungen || { fronleichnamRegional: false, gcalClientId: '' };
      state.eigeneFerien = state.eigeneFerien || [];
      save(); render();
      alert('Import erfolgreich.');
    } catch (err) {
      alert('Datei konnte nicht gelesen werden: ' + err.message);
    }
  };
  reader.readAsText(file);
}

function exportIcs() {
  const jahr = state.jahr;
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Familienplaner//DE'];
  const addEvent = (uidStr, name, von, bis) => {
    lines.push('BEGIN:VEVENT', `UID:${uidStr}@familienplaner`, `DTSTAMP:${jahr}0101T000000Z`,
      `DTSTART;VALUE=DATE:${von.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${addDaysKey(bis, 1).replace(/-/g, '')}`,
      `SUMMARY:${name.replace(/[,;\n]/g, ' ')}`, 'END:VEVENT');
  };
  for (const f of alleFerien()) addEvent('ferie-' + f.von + '-' + f.bis, 'Schulferien Sachsen: ' + f.name, f.von, f.bis);
  for (const f of feiertageSachsen(jahr, false)) addEvent('feiertag-' + f.key, 'Feiertag: ' + f.name, f.key, f.key);
  for (const e of state.eintraege) {
    const m = mitgliedById(e.mitgliedId);
    addEvent('eintrag-' + e.id, `${m ? m.name : ''}: ${TYP_LABEL[e.typ]}${e.titel ? ' – ' + e.titel : ''}`, e.von, e.bis);
  }
  lines.push('END:VCALENDAR');
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `familienplaner-${jahr}.ics`;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function gcalRequest(method, path, body) {
  const res = await fetch('https://www.googleapis.com/calendar/v3' + path, {
    method,
    headers: { Authorization: 'Bearer ' + gcalToken, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    if (res.status === 401) { gcalToken = null; throw new Error('Google-Sitzung abgelaufen – bitte neu verbinden.'); }
    const t = await res.text();
    throw new Error('Google API Fehler ' + res.status + ': ' + t.slice(0, 200));
  }
  return res.status === 204 ? null : res.json();
}

function gcalEvent(e) {
  const m = mitgliedById(e.mitgliedId);
  return {
    summary: `${m ? m.name : ''}: ${TYP_LABEL[e.typ]}${e.titel ? ' – ' + e.titel : ''}`,
    description: (e.notiz || '') + (e.typ === 'urlaub' ? `\nVerbrauchte Urlaubstage zählen über die App.` : ''),
    start: { date: e.von },
    end: { date: addDaysKey(e.bis, 1) }
  };
}

async function gcalUpsert(e) {
  try {
    if (e.gcalId) {
      await gcalRequest('PATCH', `/calendars/${encodeURIComponent(gcalCalendarId)}/events/${e.gcalId}`, gcalEvent(e));
    } else {
      const res = await gcalRequest('POST', `/calendars/${encodeURIComponent(gcalCalendarId)}/events`, gcalEvent(e));
      e.gcalId = res.id;
      save();
    }
  } catch (err) { console.warn('GCAL upsert fehlgeschlagen', err); }
}

async function gcalDelete(gcalId) {
  try {
    await gcalRequest('DELETE', `/calendars/${encodeURIComponent(gcalCalendarId)}/events/${gcalId}`);
  } catch (err) { console.warn('GCAL delete fehlgeschlagen', err); }
}

async function gcalConnect() {
  const clientId = (state.einstellungen?.gcalClientId || '').trim();
  if (!clientId) { alert('Bitte zuerst die Google Client-ID in den Einstellungen hinterlegen.'); return; }
  if (!window.google || !google.accounts || !google.accounts.oauth2) { alert('Google-Login-Skript lädt noch… bitte kurz warten.'); return; }
  const tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: 'https://www.googleapis.com/auth/calendar',
    callback: (resp) => {
      if (resp.error) { alert('Google-Login fehlgeschlagen: ' + resp.error); return; }
      gcalToken = resp.access_token;
      gcalSync();
    }
  });
  tokenClient.requestAccessToken({ prompt: 'consent' });
}

async function gcalSync() {
  const status = document.getElementById('gcalStatus');
  status.textContent = 'Synchronisiere mit Google Kalender…';
  try {
    const list = await gcalRequest('GET', '/users/me/calendarList');
    let cal = (list.items || []).find(c => c.summary === 'Familienplaner');
    if (!cal) {
      cal = await gcalRequest('POST', '/users/me/calendarList', { summary: 'Familienplaner' });
    }
    gcalCalendarId = cal.id;
    const remote = await gcalRequest('GET', `/calendars/${encodeURIComponent(gcalCalendarId)}/events?maxResults=2500`);
    const remoteIds = new Set((remote.items || []).map(i => i.id));
    const lokalIds = new Set();
    for (const e of state.eintraege) {
      await gcalUpsert(e);
      if (e.gcalId) lokalIds.add(e.gcalId);
    }
    for (const rid of remoteIds) {
      if (!lokalIds.has(rid)) await gcalDelete(rid);
    }
    status.textContent = `Synchronisiert: ${state.eintraege.length} Einträge im Kalender „Familienplaner“.`;
  } catch (err) {
    status.textContent = 'Fehler: ' + err.message;
  }
}

function init() {
  document.getElementById('jahrSelect').addEventListener('change', (ev) => {
    state.jahr = Number(ev.target.value); save(); render();
  });
  document.getElementById('btnAnsichtMonate').addEventListener('click', () => {
    state.ansicht = 'monate'; save(); render();
  });
  document.getElementById('btnAnsichtWand').addEventListener('click', () => {
    state.ansicht = 'wand'; save(); render();
  });
  document.getElementById('btnAnsichtListe').addEventListener('click', () => {
    state.ansicht = 'liste'; save(); render();
  });
  document.getElementById('selectWandMitglied').addEventListener('change', (ev) => {
    state.wandMitglied = ev.target.value; auswahl.clear(); auswahlAnker = null; save(); render();
  });
  document.getElementById('markUrlaub').addEventListener('click', () => markiereAuswahl('urlaub'));
  document.getElementById('markTermin').addEventListener('click', () => markiereAuswahl('termin'));
  document.getElementById('markSchulfrei').addEventListener('click', () => markiereAuswahl('schulfrei'));
  document.getElementById('btnAuswahlClear').addEventListener('click', () => {
    auswahl.clear(); auswahlAnker = null; renderWandkalender();
  });
  const jm = document.getElementById('jumpMonat');
  if (jm) {
    jm.innerHTML = MONATSNAMEN.map((n, i) => `<option value="${i + 1}">${n}</option>`).join('');
    jm.addEventListener('change', (ev) => jumpMonat(ev.target.value));
  }
  document.getElementById('btnJumpKW').addEventListener('click', () => jumpKW(document.getElementById('jumpKW').value));
  document.getElementById('btnJumpDatum').addEventListener('click', () => jumpDatum(document.getElementById('jumpDatum').value));
  document.getElementById('btnNeu').addEventListener('click', () => openEintragModal());
  document.getElementById('btnEinstellungen').addEventListener('click', () => { renderEinstellungen(); openModal('einstellModal'); });
  document.getElementById('btnExport').addEventListener('click', exportJson);
  document.getElementById('btnIcs').addEventListener('click', exportIcs);
  document.getElementById('btnImport').addEventListener('click', () => document.getElementById('importFile').click());
  document.getElementById('importFile').addEventListener('change', (ev) => {
    if (ev.target.files[0]) importJson(ev.target.files[0]);
    ev.target.value = '';
  });
  document.getElementById('btnGcal').addEventListener('click', gcalConnect);
  document.getElementById('eintragSpeichern').addEventListener('click', submitEintrag);
  document.querySelectorAll('.modal .schliessen').forEach(b => b.addEventListener('click', () => {
    b.closest('.modal').classList.remove('offen');
  }));
  document.querySelectorAll('.modal').forEach(m => m.addEventListener('click', (ev) => {
    if (ev.target === m) m.classList.remove('offen');
  }));
  const s = document.createElement('script');
  s.src = 'https://accounts.google.com/gsi/client';
  s.async = true;
  s.defer = true;
  document.head.appendChild(s);
  load().then(render);
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', init);
}

if (typeof module !== 'undefined') {
  module.exports = { ostern, bussUndBettag, feiertageSachsen, toKey, fromKey, addDaysKey, isWerktag, isoKW, istHalbtag, urlaubstageImJahr, hatWerktagZwischen, mergeBloecke, FERIEN_SACHSEN };
}
