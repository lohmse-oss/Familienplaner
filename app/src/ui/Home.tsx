import { addDays, dow, fmt, fmtShort, range, today, WD, WD_LONG } from '../core/dates';
import { dayTag, evText, isMultiDay, needsOwner, timeOn } from '../core/calendar';
import { nextGap } from '../core/gaps';
import { budget } from '../core/report';
import { PARENTS, PERSONS, type Item, type PersonId } from '../core/types';
import { bridgeTips, bridgeYear } from '../core/tips';
import { fmtDays } from '../core/dates';
import { useState } from 'preact/hooks';
import type { Tab } from '../nav';
import { answerAsk, useStore } from '../store';
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

/** Gesehene Rückmeldungen auf eigene Anfragen (nur auf diesem Handy, damit „OK“ nichts an den Partner meldet). */
const SEEN_KEY = 'fp.askSeen';
const seenAsks = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
};

export function Home({ go, openDay, plan, edit }: { go: (t: Tab) => void; openDay: (d: string) => void; plan: (days?: string[], persons?: PersonId[]) => void; edit: (it: Item) => void }) {
  const [seen, setSeen] = useState(seenAsks);
  const markSeen = (key: string) => {
    const next = [...seen, key].slice(-50);
    setSeen(next);
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(next));
    } catch {
      /* egal */
    }
  };
  const { cal, settings, items, readOnly } = useStore();
  const t = today();
  const d = cal.day(t);
  const gap = nextGap(cal, t, 90);
  const py = Number(t.slice(0, 4)); // laufendes Jahr

  // Termine der nächsten 7 Tage (ohne heute)
  const L = settings.layers;
  const soon = [...range(addDays(t, 1), addDays(t, 7))]
    .flatMap((date) => {
      const d = cal.day(date);
      return [
        ...(L.events ? d.events.filter((e) => !isMultiDay(e) || date === e.start || date === addDays(t, 1)).map((e) => ({ date, key: e.id, icon: 'addcal' as IconName, text: evText(e, date), e })) : []),
        ...(L.tasks ? d.tasks.filter((x) => !x.done).map((x) => ({ date, key: x.id, icon: 'tasks' as IconName, text: `Aufgabe fällig: ${x.title}`, e: x })) : []),
        ...(L.birthdays ? d.birthdays.map((b) => ({ date, key: b.id, icon: 'cake' as IconName, text: `Geburtstag: ${b.title}`, e: b })) : []),
      ];
    })
    .slice(0, 6);
  const overdue = items.filter((i) => i.kind === 'task' && !i.deleted && !i.done && i.start < t).length;
  const unowned = [...range(t, addDays(t, 14))].reduce((n, date) => n + cal.day(date).events.filter((e) => needsOwner(e) && !e.owner).length, 0);

  // Neu vom Partner (letzte 7 Tage)
  const partner = settings.me === 'betty' ? 'sebastian' : 'betty';
  const recent = items
    .filter((i) => !i.deleted && i.by === partner && verbOf(i) === 'new' && describeChange(i) && i.updated > Date.now() - 7 * 864e5)
    .sort((a, b) => b.updated - a.updated)
    .slice(0, 5);

  // Übernahme-Anfragen: an mich (beantworten) und Antworten auf meine (zur Kenntnis, 7 Tage)
  const asks = cal.items.filter((i) => i.ask && (i.kind === 'event' || i.kind === 'task'));
  const askMe = readOnly ? [] : asks.filter((i) => i.ask!.to === settings.me && i.ask!.state === 'open');
  const myAsks = readOnly ? [] : asks.filter((i) => i.ask!.from === settings.me && (i.ask!.state === 'open' || (i.ask!.at > Date.now() - 7 * 864e5 && !seen.includes(`${i.id}:${i.ask!.at}`))));
  const askWhen = (i: Item) => `${WD[dow(i.start)]} ${fmtShort(i.start)}${i.time ? `, ${i.time}` : ''}`;

  // Brückentage-Tipps (Oktober–Dezember zusätzlich die Bilanz fürs Folgejahr, wenn die Urlaubsplanung ansteht)
  const tips = readOnly ? [] : bridgeTips(cal, t, 3);
  const month = Number(t.slice(5, 7));
  const yearSum = month >= 10 ? { y: py + 1, ...bridgeYear(cal, py + 1) } : null;

  const openTasks = items.filter((i) => i.kind === 'task' && !i.deleted && !i.done).length;
  const openShop = items.filter((i) => i.kind === 'shop' && !i.deleted && !i.done).length;
  const bdays = items.filter((i) => i.kind === 'birthday' && !i.deleted).length;
  const free = PARENTS.map((p) => ({ p, b: budget(cal, p, py, t) }));
  const freeText = free.every((x) => x.b.free === undefined) ? 'Urlaubstage eintragen' : free.map((x) => `${PERSONS[x.p].name.slice(0, 3)} ${x.b.free ?? '–'}`).join(' · ') + ` frei (${py})`;

  const tiles: { tab: Tab; icon: IconName; title: string; sub: string; badge?: string }[] = [
    { tab: 'cal', icon: 'week', title: 'Kalender', sub: 'Tag · Woche · Jahr · Verlauf' },
    { tab: 'vacation', icon: 'palm', title: 'Urlaub', sub: freeText },
    { tab: 'shop', icon: 'cart', title: 'Einkauf', sub: openShop ? `${openShop} offen` : 'Alles besorgt', badge: openShop ? String(openShop) : undefined },
    { tab: 'tasks', icon: 'tasks', title: 'Aufgaben', sub: openTasks ? `${openTasks} offen` : 'Nichts offen', badge: openTasks ? String(openTasks) : undefined },
    { tab: 'birthdays', icon: 'cake', title: 'Geburtstage', sub: `${bdays} eingetragen` },
  ];

  return (
    <div class="page home">
      <div class="hello">
        <div>
          <h2>Hallo {PERSONS[settings.me].name}</h2>
          <span class="muted">{WD_LONG[dow(t)]}, {fmt(t)}</span>
          {!readOnly && <small class="hint home-tip">Neuer Eintrag: Startknopf unten lang drücken</small>}
        </div>
        <div class="hello-actions">
          <button class="icon-btn" onClick={() => go('settings')} aria-label="Einstellungen"><Ic n="settings" size={20} /></button>
        </div>
      </div>

      <div class="home-cols">
      <div>

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
            <span class="time">{timeOn(e, t) ?? '·'}</span>
            <span class="grow">{e.title}{dayTag(e, t) && <small class="muted"> · {dayTag(e, t)}</small>}</span>
            {e.owner ? <PersonTag p={e.owner} /> : needsOwner(e) ? <span class="open">offen</span> : null}
          </div>
        ))}
        {d.tasks.map((x) => <div key={x.id} class={`line ${x.done ? 'done' : ''}`}><Ic n="tasks" size={16} /> {x.title}</div>)}
        {d.birthdays.map((b) => <div key={b.id} class="line"><Ic n="cake" size={16} /> {b.title}</div>)}
        {!d.holiday && !d.needs.length && !d.events.length && !d.birthdays.length && <div class="line muted">Heute nichts Besonderes.</div>}
      </section>

      {askMe.length + myAsks.length > 0 && (
        <section class="card ask-card">
          <header class="card-head"><strong><Ic n="send" size={15} /> Übernahme-Anfragen</strong></header>
          {askMe.map((i) => (
            <div key={i.id} class="ask">
              <div class="link-row" onClick={() => edit(i)}>
                <b>{PERSONS[i.ask!.from].name} fragt: Übernimmst du?</b>
                <div>{i.title} <span class="muted">· {askWhen(i)}</span></div>
              </div>
              <div class="actions">
                <button class="btn small" onClick={() => answerAsk(i, false)}>Ablehnen</button>
                <button class="btn small primary" onClick={() => answerAsk(i, true)}><Ic n="check" size={14} /> Zusagen</button>
              </div>
            </div>
          ))}
          {myAsks.map((i) => {
            const a = i.ask!;
            const who = PERSONS[a.to].name;
            return (
              <div key={i.id} class={`line ask-reply ${a.state}`}>
                <Ic n={a.state === 'accepted' ? 'check' : a.state === 'declined' ? 'x' : 'clock'} size={15} />
                <span class="grow link-row" onClick={() => edit(i)}>
                  {a.state === 'open' ? `Warte auf ${who}: ` : a.state === 'accepted' ? `${who} übernimmt: ` : `${who} kann nicht: `}
                  {i.title} <span class="muted">· {askWhen(i)}</span>
                </span>
                {a.state !== 'open' && <button class="icon-btn" aria-label="Gesehen" onClick={() => markSeen(`${i.id}:${a.at}`)}><Ic n="x" size={14} /></button>}
              </div>
            );
          })}
        </section>
      )}

      {(gap || unowned > 0 || overdue > 0) && (
        <section class="card attn">
          <header class="card-head"><strong>Achtung</strong></header>
          {gap && (
            <div class="line link-row need" onClick={() => go('vacation')}>
              <span class="grow"><i class="lamp lamp-gap" /> Betreuung offen {fmtShort(gap.start)}–{fmtShort(gap.end)}: {gap.who} ({gap.why})</span><Ic n="right" size={16} />
            </div>
          )}
          {overdue > 0 && (
            <div class="line link-row need" onClick={() => go('tasks')}>
              <span class="grow"><Ic n="tasks" size={15} /> {overdue} Aufgabe{overdue === 1 ? '' : 'n'} überfällig</span><Ic n="right" size={16} />
            </div>
          )}
          {unowned > 0 && (
            <div class="line link-row" onClick={() => go('cal')}>
              <span class="grow"><Ic n="warn" size={15} /> {unowned} Termin{unowned === 1 ? '' : 'e'} in den nächsten 14 Tagen ohne Zuständigen</span><Ic n="right" size={16} />
            </div>
          )}
        </section>
      )}

      {!readOnly && recent.length > 0 && (
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

      {soon.length > 0 && (
        <section class="card">
          <header class="card-head"><strong>Demnächst</strong>{overdue > 0 && <span class="pill pill-gap">{overdue} Aufgabe{overdue === 1 ? '' : 'n'} überfällig</span>}</header>
          {soon.map(({ date, key, icon, text, e }) => (
            <div key={key + date} class="line link-row" onClick={() => openDay(date)}>
              <span class="time wide">{WD[dow(date)]} {fmtShort(date)}</span>
              <Ic n={icon} size={15} class="muted" />
              <span class="grow">{text}</span>
              {e.owner ? <PersonTag p={e.owner} /> : e.kind === 'event' && needsOwner(e) ? <span class="open">offen</span> : null}
            </div>
          ))}
        </section>
      )}

      {(tips.length > 0 || (yearSum && yearSum.count > 0)) && (
        <section class="card">
          <header class="card-head"><strong><Ic n="bridge" size={15} /> Brückentage-Tipps</strong><button class="link small" onClick={() => go('vacation')}>alle</button></header>
          {yearSum && yearSum.count > 0 && (
            <div class="bridge-sum">
              <b>{yearSum.y}:</b> {yearSum.count} Brückentage – mit <b>{fmtDays(yearSum.cost)} Urlaubstagen</b> zusammen <b>{yearSum.total} Tage frei</b>. Jetzt ist die Zeit für die Urlaubsanträge.
            </div>
          )}
          {tips.map((b) => (
            <div key={b.gapStart} class="line bridge-tip">
              <span class="grow">
                <b>{b.gapStart === b.gapEnd ? `${WD[dow(b.gapStart)]} ${fmt(b.gapStart)}` : `${WD[dow(b.gapStart)]} ${fmtShort(b.gapStart)}–${WD[dow(b.gapEnd)]} ${fmt(b.gapEnd)}`}</b>
                <small>
                  {fmtDays(b.cost)} Urlaubstag{b.cost === 1 ? '' : 'e'} → {b.total} Tage frei · {[...new Set(b.holidays)].join(', ')}
                  {b.idaFree === b.days ? ' · Ida hat schulfrei' : ''}
                  {b.taken.length ? ` · ${b.taken.map((p) => PERSONS[p].name).join(', ')} hat schon Urlaub` : ''}
                </small>
              </span>
              <button class="btn small" onClick={() => plan([b.gapStart, b.gapEnd], PARENTS.filter((p) => !b.taken.includes(p)))}>Planen</button>
            </div>
          ))}
        </section>
      )}
      </div>

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
    </div>
  );
}
