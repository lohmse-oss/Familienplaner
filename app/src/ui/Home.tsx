import { addDays, diff, dow, fmt, fmtShort, range, today, WD, WD_LONG } from '../core/dates';
import { dayTag, evText, isMultiDay, needsOwner, timeOn, type DayInfo } from '../core/calendar';
import { nextGap } from '../core/gaps';
import { PARENTS, PERSONS, type Item } from '../core/types';
import { isDueSoon } from '../core/recur';
import { mealOn } from '../core/meals';
import { Fragment } from 'preact';
import { useRef, useState } from 'preact/hooks';
import type { Tab } from '../nav';
import { answerAsk, useStore } from '../store';
import { describeChange, verbOf } from '../core/describe';
import { Dot, PersonTag, Pill, Sheet, STATUS_LABEL, TaskCheck } from './common';
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

/** Einträge eines Tages (Mahlzeit, Feiertag, Betreuungsbedarf, Termine, Aufgaben, Geburtstage) – für Heute- und Morgen-Karte. */
function DayLines({ d, date, items, go }: { d: DayInfo; date: string; items: Item[]; go: (t: Tab) => void }) {
  const meal = mealOn(items, date);
  return (
    <>
      {meal && (
        <div class={`line link-row ${meal.done ? 'done' : ''}`} onClick={(e) => { e.stopPropagation(); go('meals'); }} title="Zu den Mahlzeiten">
          <Ic n="meal" size={16} /> <span class="grow">{meal.title}</span>{meal.done && <Ic n="check" size={14} class="muted" />}
        </div>
      )}
      {d.holiday && <div class="line"><Ic n="flag" size={16} /> {d.holiday}</div>}
      {d.needs.map((n) => <div key={n.child + n.reason} class={`line ${d.coverage === 'gap' ? 'need' : ''}`}><Dot p={n.child} />{PERSONS[n.child].name}: {n.reason}</div>)}
      {d.events.map((e) => (
        <div key={e.id} class="line">
          <span class="time">{timeOn(e, date) ?? '·'}</span>
          <span class="grow">{e.title}{dayTag(e, date) && <small class="muted"> · {dayTag(e, date)}</small>}</span>
          {e.owner ? <PersonTag p={e.owner} /> : needsOwner(e) ? <span class="open">offen</span> : null}
        </div>
      ))}
      {d.tasks.map((x) => <div key={x.id} class={`line ${x.done ? 'done' : ''}`}><TaskCheck t={x} /><Ic n="tasks" size={16} /> {x.title}</div>)}
      {d.birthdays.map((b) => <div key={b.id} class="line"><Ic n="cake" size={16} /> {b.title}</div>)}
    </>
  );
}

export function Home({ go, openDay, edit }: { go: (t: Tab) => void; openDay: (d: string) => void; edit: (it: Item) => void }) {
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
  const [pop, setPop] = useState<null | 'attn' | 'asks' | 'partner'>(null);
  // Info-Chips per Swipe wegwischen: gemerkt pro Typ mit damaliger Zahl; bei mehr Inhalt kommen sie wieder
  const [chipOff, setChipOff] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem('fp.chipOff') ?? '{}') as Record<string, number>; } catch { return {}; }
  });
  const chipDrag = useRef(0);
  const showChip = (type: string, n: number) => n > (chipOff[type] ?? 0);
  const dismissChip = (type: string, n: number) => {
    const next = { ...chipOff, [type]: n };
    setChipOff(next);
    try { localStorage.setItem('fp.chipOff', JSON.stringify(next)); } catch { /* egal */ }
  };
  const { cal, settings, items, readOnly } = useStore();
  const t = today();
  const d = cal.day(t);
  const tm = cal.day(addDays(t, 1));
  const gap = nextGap(cal, t, 90);
  const sunday = dow(t) === 6;

  // Termine/Aufgaben/Geburtstage der nächsten 7 Tage (ohne heute)
  const L = settings.layers;
  const soonAll = [...range(addDays(t, 1), addDays(t, 7))]
    .flatMap((date) => {
      const dd = cal.day(date);
      return [
        ...(L.events ? dd.events.filter((e) => !isMultiDay(e) || date === e.start || date === addDays(t, 1)).map((e) => ({ date, key: e.id, icon: 'addcal' as IconName, text: evText(e, date), e })) : []),
        ...(L.tasks ? dd.tasks.filter((x) => !x.done).map((x) => ({ date, key: x.id, icon: 'tasks' as IconName, text: `Aufgabe fällig: ${x.title}`, e: x })) : []),
        ...(L.birthdays ? dd.birthdays.map((b) => ({ date, key: b.id, icon: 'cake' as IconName, text: `Geburtstag: ${b.title}`, e: b })) : []),
      ];
    });
  const overdue = items.filter((i) => i.kind === 'task' && !i.deleted && !i.done && i.start < t).length;
  const unowned = [...range(t, addDays(t, 14))].reduce((n, date) => n + cal.day(date).events.filter((e) => needsOwner(e) && !e.owner).length, 0);

  // Neu vom Partner (letzte 7 Tage)
  const partner = settings.me === 'betty' ? 'sebastian' : 'betty';
  const recent = items
    .filter((i) => !i.deleted && i.by === partner && verbOf(i) === 'new' && describeChange(i) && i.updated > Date.now() - 7 * 864e5)
    .sort((a, b) => b.updated - a.updated)
    .slice(0, 10);

  // Übernahme-Anfragen: an mich (beantworten) und Antworten auf meine (zur Kenntnis, 7 Tage)
  const asks = cal.items.filter((i) => i.ask && (i.kind === 'event' || i.kind === 'task'));
  const askMe = readOnly ? [] : asks.filter((i) => i.ask!.to === settings.me && i.ask!.state === 'open');
  const myAsks = readOnly ? [] : asks.filter((i) => i.ask!.from === settings.me && (i.ask!.state === 'open' || (i.ask!.at > Date.now() - 7 * 864e5 && !seen.includes(`${i.id}:${i.ask!.at}`))));
  const askWhen = (i: Item) => `${WD[dow(i.start)]} ${fmtShort(i.start)}${i.time ? `, ${i.time}` : ''}`;

  const fristen = cal.items.filter((i) => isDueSoon(i, t)).sort((a, b) => a.start.localeCompare(b.start));

  const attnN = (gap ? 1 : 0) + fristen.length + (overdue > 0 ? 1 : 0) + (unowned > 0 ? 1 : 0);
  const askN = askMe.length + myAsks.length;

  return (
    <div class="page home">
      <div class="hello">
        <div>
          <h2>Hallo {PERSONS[settings.me].name}</h2>
          <span class="muted">{WD_LONG[dow(t)]}, {fmt(t)}</span>
          {!readOnly && <small class="hint home-tip">Neuer Eintrag: Startknopf lang drücken</small>}
        </div>
      </div>

      <div class="home-feed">

      {/* Status-Chips: Symbol + Zahl – Klick öffnet Pop-up mit den Details */}
      {(showChip('attn', attnN) || showChip('asks', askN) || showChip('partner', recent.length)) && (
        <div class="home-chips">
          {showChip('attn', attnN) && (
            <button class={`chip-tile ${gap || overdue > 0 ? 'bad' : ''}`} onClick={() => setPop('attn')} title="Klick = Details · seitlich wischen = ausblenden"
              onPointerDown={(e) => { chipDrag.current = e.clientX; }} onPointerUp={(e) => { if (Math.abs(e.clientX - chipDrag.current) > 50) dismissChip('attn', attnN); }}>
              <Ic n="warn" size={20} /><b>{attnN}</b><small>Achtung</small>
            </button>
          )}
          {showChip('asks', askN) && (
            <button class="chip-tile" onClick={() => setPop('asks')} title="Klick = Details · seitlich wischen = ausblenden"
              onPointerDown={(e) => { chipDrag.current = e.clientX; }} onPointerUp={(e) => { if (Math.abs(e.clientX - chipDrag.current) > 50) dismissChip('asks', askN); }}>
              <Ic n="send" size={20} /><b>{askN}</b><small>Anfragen</small>
            </button>
          )}
          {showChip('partner', recent.length) && (
            <button class="chip-tile" onClick={() => setPop('partner')} title="Klick = Details · seitlich wischen = ausblenden"
              onPointerDown={(e) => { chipDrag.current = e.clientX; }} onPointerUp={(e) => { if (Math.abs(e.clientX - chipDrag.current) > 50) dismissChip('partner', recent.length); }}>
              <Ic n="bell" size={20} /><b>{recent.length}</b><small>Neu</small>
            </button>
          )}
        </div>
      )}

      <section class="card today-card" onClick={() => openDay(t)}>
        <header class="card-head"><strong>Heute</strong><Pill coverage={d.coverage} /></header>
        <div class="who-row">
          {PARENTS.map((p) => (
            <span key={p} class="who" style={{ borderColor: PERSONS[p].color }}>
              <Dot p={p} />{PERSONS[p].name} <StatusIc s={d.parents[p].status} size={15} /> {d.parents[p].status === 'free' ? '' : STATUS_LABEL[d.parents[p].status]}
            </span>
          ))}
        </div>
        <DayLines d={d} date={t} items={items} go={go} />
        {!d.holiday && !d.needs.length && !d.events.length && !d.birthdays.length && <div class="line muted">Heute nichts Besonderes.</div>}
      </section>

      <section class="card today-card" onClick={() => openDay(addDays(t, 1))}>
        <header class="card-head"><strong>Morgen</strong><span class="muted small">{WD[dow(addDays(t, 1))]}, {fmtShort(addDays(t, 1))}</span><Pill coverage={tm.coverage} /></header>
        <DayLines d={tm} date={addDays(t, 1)} items={items} go={go} />
        {!tm.holiday && !tm.needs.length && !tm.events.length && !tm.birthdays.length && <div class="line muted">Morgen nichts Besonderes.</div>}
      </section>

      {sunday ? (
        <section class="card">
          <header class="card-head"><strong><Ic n="week" size={15} /> Briefing: Woche ab {WD[dow(addDays(t, 1))]}, {fmtShort(addDays(t, 1))}</strong></header>
          {gap && (
            <div class="line link-row need" onClick={() => go('vacation')}>
              <span class="grow"><i class="lamp lamp-gap" /> Betreuung offen {fmtShort(gap.start)}–{fmtShort(gap.end)}: {gap.who} ({gap.why})</span><Ic n="right" size={16} />
            </div>
          )}
          {soonAll.length === 0 && !gap && <div class="line muted">Nächste Woche steht noch nichts an.</div>}
          {soonAll.map(({ date, key, icon, text, e }) => (
            <div key={key + date} class="line link-row" onClick={() => openDay(date)}>
              <span class="time wide">{WD[dow(date)]} {fmtShort(date)}</span>
              {e.kind === 'task' && <TaskCheck t={e} />}
              <Ic n={icon} size={15} class="muted" />
              <span class="grow">{text}</span>
              {e.owner ? <PersonTag p={e.owner} /> : e.kind === 'event' && needsOwner(e) ? <span class="open">offen</span> : null}
            </div>
          ))}
        </section>
      ) : (
        <section class="card">
          <header class="card-head"><strong>Demnächst</strong>{overdue > 0 && <span class="pill pill-gap">{overdue} Aufgabe{overdue === 1 ? '' : 'n'} überfällig</span>}</header>
          {(() => {
            const days = [...range(addDays(t, 2), addDays(t, 8))]; // heute & morgen sind eigene Karten oben
            return (
              <div class="strip2">
                <span class="h" />
                {days.map((d) => <span key={d} class="h">{WD[dow(d)]} {d.slice(8)}</span>)}
                {PARENTS.map((p) => (
                  <Fragment key={p}>
                    <span class="who-l" style={{ color: PERSONS[p].color }} title={PERSONS[p].name}>{PERSONS[p].name[0]}</span>
                    {days.map((d) => {
                      const dd = cal.day(d);
                      // Familien-Einträge (ohne Zuständigen/Personen) zählen für beide Eltern
                      const evs = L.events ? dd.events.filter((e) => e.owner === p || e.persons.includes(p) || (!e.owner && e.persons.length === 0)).length : 0;
                      const tks = L.tasks ? dd.tasks.filter((x) => !x.done && (x.owner === p || !x.owner)).length : 0;
                      return (
                        <button key={d} class="cell" title={`${PERSONS[p].name}, ${WD_LONG[dow(d)]}, ${fmt(d)} – 4 Segmente wie das App-Icon`} onClick={() => openDay(d)}>
                          {/* 4 Segmente (2x2) wie das App-Icon; eingefärbt + Zahl nur bei Inhalt, Farben = Icon-Punkte */}
                          <span class={`q ${dd.parents[p].status !== 'free' && dd.parents[p].status !== 'office' ? 'on' : ''}`} style={dd.parents[p].status !== 'free' && dd.parents[p].status !== 'office' ? { color: '#7FB7D6', background: '#7FB7D62E' } : undefined} title="Status (Anwesenheit)">
                            {dd.parents[p].status !== 'free' && dd.parents[p].status !== 'office' && <StatusIc s={dd.parents[p].status} size={11} />}
                          </span>
                          <span class={`q ${evs > 0 ? 'on' : ''}`} style={evs > 0 ? { color: '#F06CA0', background: '#F06CA02E' } : undefined} title="Termine">
                            {evs > 0 && <><Ic n="addcal" size={9} />{evs}</>}
                          </span>
                          <span class={`q ${tks > 0 ? 'on' : ''}`} style={tks > 0 ? { color: '#A98AE0', background: '#A98AE02E' } : undefined} title="Aufgaben">
                            {tks > 0 && <><Ic n="tasks" size={9} />{tks}</>}
                          </span>
                          <span class={`q ${dd.needs.length > 0 || dd.coverage !== 'none' ? 'on' : ''}`} style={dd.needs.length > 0 || dd.coverage !== 'none' ? { color: '#FF8A5C', background: '#FF8A5C2E' } : undefined} title="Betreuung">
                            {dd.needs.length > 0 ? <Ic n="alert" size={9} /> : dd.coverage !== 'none' ? <i class={`lamp lamp-${dd.coverage}`} /> : null}
                          </span>
                        </button>
                      );
                    })}
                  </Fragment>
                ))}
              </div>
            );
          })()}
          <div class="hint">S/B = Sebastian/Betty · je Tag 4 Segmente wie das App-Icon, eingefärbt bei jedem Eintrag (ab 1) · Tag antippen = Details · Chips seitlich wischen = ausblenden</div>
        </section>
      )}
      </div>

      {pop === 'attn' && (
        <Sheet title="Achtung" onClose={() => setPop(null)}>
          {gap && (
            <div class="line link-row need" onClick={() => { setPop(null); go('vacation'); }}>
              <span class="grow"><i class="lamp lamp-gap" /> Betreuung offen {fmtShort(gap.start)}–{fmtShort(gap.end)}: {gap.who} ({gap.why})</span><Ic n="right" size={16} />
            </div>
          )}
          {fristen.map((f) => (
            <div key={f.id} class="line link-row" onClick={() => { setPop(null); edit(f); }}>
              <span class="grow"><Ic n="bell" size={15} /> {f.title}: läuft am {fmt(f.start)} ab – jetzt kümmern <span class="muted">(noch {diff(t, f.start)} Tage)</span></span><Ic n="right" size={16} />
            </div>
          ))}
          {overdue > 0 && (
            <div class="line link-row need" onClick={() => { setPop(null); go('tasks'); }}>
              <span class="grow"><Ic n="tasks" size={15} /> {overdue} Aufgabe{overdue === 1 ? '' : 'n'} überfällig</span><Ic n="right" size={16} />
            </div>
          )}
          {unowned > 0 && (
            <div class="line link-row" onClick={() => { setPop(null); go('cal'); }}>
              <span class="grow"><Ic n="warn" size={15} /> {unowned} Termin{unowned === 1 ? '' : 'e'} in den nächsten 14 Tagen ohne Zuständigen</span><Ic n="right" size={16} />
            </div>
          )}
        </Sheet>
      )}

      {pop === 'asks' && (
        <Sheet title="Übernahme-Anfragen" onClose={() => setPop(null)}>
          {askMe.map((i) => (
            <div key={i.id} class="ask">
              <div class="link-row" onClick={() => { setPop(null); edit(i); }}>
                <b>{PERSONS[i.ask!.from].name} fragt: übernimmst du?</b>
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
                <span class="grow link-row" onClick={() => { setPop(null); edit(i); }}>
                  {a.state === 'open' ? `Warte auf ${who}: ` : a.state === 'accepted' ? `${who} übernimmt: ` : `${who} kann nicht: `}
                  {i.title} <span class="muted">· {askWhen(i)}</span>
                </span>
                {a.state !== 'open' && <button class="icon-btn" aria-label="Gesehen" onClick={() => markSeen(`${i.id}:${a.at}`)}><Ic n="x" size={14} /></button>}
              </div>
            );
          })}
        </Sheet>
      )}

      {pop === 'partner' && (
        <Sheet title={`Neu von ${PERSONS[partner].name}`} onClose={() => setPop(null)}>
          {recent.map((i) => (
            <div key={i.id} class="line link-row" onClick={() => { setPop(null); openDay(i.start); }}>
              <span class="grow">{describeChange(i)!.text}</span>
              <span class="muted small">{ago(i.updated)}</span>
            </div>
          ))}
        </Sheet>
      )}
    </div>
  );
}
