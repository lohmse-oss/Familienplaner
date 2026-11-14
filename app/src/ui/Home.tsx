import { addDays, dow, fmt, fmtShort, planningYear, range, today, WD, WD_LONG } from '../core/dates';
import { needsOwner } from '../core/calendar';
import { nextGap } from '../core/gaps';
import { budget } from '../core/report';
import { PARENTS, PERSONS } from '../core/types';
import type { Tab } from '../nav';
import { useStore } from '../store';
import { describeChange, verbOf } from '../core/describe';
import { Dot, PersonTag, Pill, STATUS_LABEL } from './common';
import { Ic, StatusIc, type IconName } from './icons';

const ago = (ms: number) => {
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 2) return 'gerade eben';
  if (m < 60) return `vor ${m} Min.`;
  if (m < 1440) return `vor ${Math.round(m / 60)} Std.`;
  return `vor ${Math.round(m / 1440)} Tg.`;
};

export function Home({ go, openDay, add }: { go: (t: Tab) => void; openDay: (d: string) => void; add: () => void }) {
  const { cal, settings, items } = useStore();
  const t = today();
  const d = cal.day(t);
  const gap = nextGap(cal, t, 90);
  const py = planningYear();

  // Termine der nächsten 7 Tage (ohne heute)
  const upcoming = [...range(addDays(t, 1), addDays(t, 7))].flatMap((date) => cal.day(date).events.map((e) => ({ date, e }))).slice(0, 5);
  const unowned = [...range(t, addDays(t, 14))].reduce((n, date) => n + cal.day(date).events.filter((e) => needsOwner(e) && !e.owner).length, 0);

  // Neu vom Partner (letzte 7 Tage)
  const partner = settings.me === 'betty' ? 'sebastian' : 'betty';
  const recent = items
    .filter((i) => !i.deleted && i.by === partner && verbOf(i) === 'new' && describeChange(i) && i.updated > Date.now() - 7 * 864e5)
    .sort((a, b) => b.updated - a.updated)
    .slice(0, 5);

  const openTasks = items.filter((i) => i.kind === 'task' && !i.deleted && !i.done).length;
  const openShop = items.filter((i) => i.kind === 'shop' && !i.deleted && !i.done).length;
  const free = PARENTS.map((p) => ({ p, b: budget(cal, p, py, t) }));
  const freeText = free.every((x) => x.b.free === undefined) ? 'Urlaubstage eintragen' : free.map((x) => `${PERSONS[x.p].name.slice(0, 3)} ${x.b.free ?? '–'}`).join(' · ') + ' frei';

  const tiles: { tab: Tab; icon: IconName; title: string; sub: string; badge?: string }[] = [
    { tab: 'week', icon: 'week', title: 'Wochenplan', sub: 'Wer ist wo, Termine, Betreuung' },
    { tab: 'year', icon: 'year', title: 'Jahresplaner', sub: 'Zeiträume markieren, Ferien, Brücken' },
    { tab: 'vacation', icon: 'palm', title: 'Urlaubsverwaltung', sub: freeText },
    { tab: 'shop', icon: 'cart', title: 'Einkaufsliste', sub: openShop ? `${openShop} offen` : 'Alles besorgt', badge: openShop ? String(openShop) : undefined },
    { tab: 'tasks', icon: 'tasks', title: 'Aufgaben & Geburtstage', sub: openTasks ? `${openTasks} offen` : 'Nichts offen', badge: openTasks ? String(openTasks) : undefined },
    { tab: 'settings', icon: 'settings', title: 'Einstellungen', sub: 'Sync, Benachrichtigungen' },
  ];

  return (
    <div class="page">
      <div class="hello">
        <div>
          <h2>Hallo {PERSONS[settings.me].name}</h2>
          <span class="muted">{WD_LONG[dow(t)]}, {fmt(t)}</span>
        </div>
        <button class="btn primary" onClick={add}><Ic n="plus" size={16} /> Eintrag</button>
      </div>

      <section class="card today-card" onClick={() => openDay(t)}>
        <header class="card-head"><strong>Heute</strong><Pill coverage={d.coverage} /></header>
        <div class="who-row">
          {PARENTS.map((p) => (
            <span key={p} class="who" style={{ borderColor: PERSONS[p].color }}>
              <Dot p={p} />{PERSONS[p].name} <StatusIc s={d.parents[p].status} size={15} /> {d.parents[p].status === 'free' ? '' : STATUS_LABEL[d.parents[p].status]}
            </span>
          ))}
        </div>
        {d.holiday && <div class="line"><Ic n="flag" size={16} /> {d.holiday}</div>}
        {d.needs.map((n) => <div key={n.child + n.reason} class={`line ${d.coverage === 'gap' ? 'need' : ''}`}><Dot p={n.child} />{PERSONS[n.child].name}: {n.reason}</div>)}
        {d.events.map((e) => (
          <div key={e.id} class="line">
            <span class="time">{e.time ?? '·'}</span>
            <span class="grow">{e.title}</span>
            {e.owner ? <PersonTag p={e.owner} /> : needsOwner(e) ? <span class="open">offen</span> : null}
          </div>
        ))}
        {d.tasks.filter((x) => !x.done).map((x) => <div key={x.id} class="line"><Ic n="tasks" size={16} /> {x.title}</div>)}
        {d.birthdays.map((b) => <div key={b.id} class="line"><Ic n="cake" size={16} /> {b.title}</div>)}
        {!d.holiday && !d.needs.length && !d.events.length && !d.birthdays.length && <div class="line muted">Heute nichts Besonderes.</div>}
      </section>

      {(gap || unowned > 0) && (
        <section class="card attn">
          <header class="card-head"><strong>Achtung</strong></header>
          {gap && (
            <div class="line link-row need" onClick={() => go('vacation')}>
              <span class="grow"><i class="lamp lamp-gap" /> Betreuung offen {fmtShort(gap.start)}–{fmtShort(gap.end)}: {gap.who} ({gap.why})</span><Ic n="right" size={16} />
            </div>
          )}
          {unowned > 0 && (
            <div class="line link-row" onClick={() => go('week')}>
              <span class="grow"><Ic n="warn" size={15} /> {unowned} Termin{unowned === 1 ? '' : 'e'} in den nächsten 14 Tagen ohne Zuständigen</span><Ic n="right" size={16} />
            </div>
          )}
        </section>
      )}

      {recent.length > 0 && (
        <section class="card">
          <header class="card-head"><strong><Ic n="bell" size={15} /> Neu von {PERSONS[partner].name}</strong></header>
          {recent.map((i) => (
            <div key={i.id} class="line link-row" onClick={() => openDay(i.start)}>
              <span class="grow">{describeChange(i)!.text}</span>
              <span class="muted small">{ago(i.updated)}</span>
            </div>
          ))}
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
            <span class="tile-ic"><Ic n={x.icon} size={26} />{x.badge && <i class="tile-badge">{x.badge}</i>}</span>
            <b>{x.title}</b>
            <small>{x.sub}</small>
          </button>
        ))}
      </div>
    </div>
  );
}
