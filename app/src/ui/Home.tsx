import { addDays, dow, fmt, fmtShort, planningYear, range, today, WD, WD_LONG } from '../core/dates';
import { needsOwner } from '../core/calendar';
import { nextGap } from '../core/gaps';
import { budget } from '../core/report';
import { PARENTS, PERSONS } from '../core/types';
import type { Tab } from '../nav';
import { useStore } from '../store';
import { Dot, PersonTag, Pill, STATUS_ICON, STATUS_LABEL } from './common';

export function Home({ go, openDay, add }: { go: (t: Tab) => void; openDay: (d: string) => void; add: () => void }) {
  const { cal, settings, items } = useStore();
  const t = today();
  const d = cal.day(t);
  const gap = nextGap(cal, t, 90);
  const py = planningYear();

  // Termine der nächsten 7 Tage (ohne heute)
  const upcoming = [...range(addDays(t, 1), addDays(t, 7))].flatMap((date) => cal.day(date).events.map((e) => ({ date, e }))).slice(0, 5);
  const unowned = [...range(t, addDays(t, 14))].reduce((n, date) => n + cal.day(date).events.filter((e) => needsOwner(e) && !e.owner).length, 0);

  const openTasks = items.filter((i) => i.kind === 'task' && !i.deleted && !i.done).length;
  const openShop = items.filter((i) => i.kind === 'shop' && !i.deleted && !i.done).length;
  const free = PARENTS.map((p) => ({ p, b: budget(cal, p, py, t) }));
  const freeText = free.every((x) => x.b.free === undefined) ? 'Urlaubstage eintragen' : free.map((x) => `${PERSONS[x.p].name.slice(0, 3)} ${x.b.free ?? '–'}`).join(' · ') + ' frei';

  const tiles: { tab: Tab; icon: string; title: string; sub: string; badge?: string }[] = [
    { tab: 'week', icon: '📅', title: 'Wochenplan', sub: 'Wer ist wo, Termine, Betreuung' },
    { tab: 'year', icon: '🗓️', title: 'Jahresforecast', sub: 'Ferien, Brücken, offene Betreuung' },
    { tab: 'vacation', icon: '🌴', title: 'Urlaubsverwaltung', sub: freeText },
    { tab: 'shop', icon: '🛒', title: 'Einkaufsliste', sub: openShop ? `${openShop} offen` : 'Alles besorgt', badge: openShop ? String(openShop) : undefined },
    { tab: 'tasks', icon: '☑', title: 'Aufgaben & Geburtstage', sub: openTasks ? `${openTasks} offen` : 'Nichts offen', badge: openTasks ? String(openTasks) : undefined },
    { tab: 'settings', icon: '⚙️', title: 'Einstellungen', sub: 'Sync, Benachrichtigungen' },
  ];

  return (
    <div class="page">
      <div class="hello">
        <div>
          <h2>Hallo {PERSONS[settings.me].name}</h2>
          <span class="muted">{WD_LONG[dow(t)]}, {fmt(t)}</span>
        </div>
        <button class="btn primary" onClick={add}>＋ Eintrag</button>
      </div>

      <section class="card today-card" onClick={() => openDay(t)}>
        <header class="card-head"><strong>Heute</strong><Pill coverage={d.coverage} /></header>
        <div class="who-row">
          {PARENTS.map((p) => (
            <span key={p} class="who" style={{ borderColor: PERSONS[p].color }}>
              <Dot p={p} />{PERSONS[p].name} {STATUS_ICON[d.parents[p].status]} {d.parents[p].status === 'free' ? '' : STATUS_LABEL[d.parents[p].status]}
            </span>
          ))}
        </div>
        {d.holiday && <div class="line">🎌 {d.holiday}</div>}
        {d.needs.map((n) => <div key={n.child + n.reason} class={`line ${d.coverage === 'gap' ? 'need' : ''}`}><Dot p={n.child} />{PERSONS[n.child].name}: {n.reason}</div>)}
        {d.events.map((e) => (
          <div key={e.id} class="line">
            <span class="time">{e.time ?? '·'}</span>
            <span class="grow">{e.title}</span>
            {e.owner ? <PersonTag p={e.owner} /> : needsOwner(e) ? <span class="open">offen</span> : null}
          </div>
        ))}
        {d.tasks.filter((x) => !x.done).map((x) => <div key={x.id} class="line">☑ {x.title}</div>)}
        {d.birthdays.map((b) => <div key={b.id} class="line">🎂 {b.title}</div>)}
        {!d.holiday && !d.needs.length && !d.events.length && !d.birthdays.length && <div class="line muted">Heute nichts Besonderes.</div>}
      </section>

      {(gap || unowned > 0) && (
        <section class="card attn">
          <header class="card-head"><strong>Achtung</strong></header>
          {gap && (
            <div class="line link-row need" onClick={() => go('vacation')}>
              <span class="grow">🔴 Betreuung offen {fmtShort(gap.start)}–{fmtShort(gap.end)}: {gap.who} ({gap.why})</span><span>›</span>
            </div>
          )}
          {unowned > 0 && (
            <div class="line link-row" onClick={() => go('week')}>
              <span class="grow">⚠ {unowned} Termin{unowned === 1 ? '' : 'e'} in den nächsten 14 Tagen ohne Zuständigen</span><span>›</span>
            </div>
          )}
        </section>
      )}

      {upcoming.length > 0 && (
        <section class="card">
          <header class="card-head"><strong>Nächste Termine</strong></header>
          {upcoming.map(({ date, e }) => (
            <div key={e.id + date} class="line link-row" onClick={() => openDay(date)}>
              <span class="time wide">{WD[dow(date)]} {fmtShort(date)}</span>
              <span class="grow">{e.time ? `${e.time} ` : ''}{e.title}</span>
              {e.owner ? <PersonTag p={e.owner} /> : needsOwner(e) ? <span class="open">offen</span> : null}
            </div>
          ))}
        </section>
      )}

      <div class="tiles">
        {tiles.map((x) => (
          <button key={x.tab} class="tile" onClick={() => go(x.tab)}>
            <span class="tile-ic">{x.icon}{x.badge && <i class="tile-badge">{x.badge}</i>}</span>
            <b>{x.title}</b>
            <small>{x.sub}</small>
          </button>
        ))}
      </div>
    </div>
  );
}
