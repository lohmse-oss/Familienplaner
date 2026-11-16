import { Capacitor } from '@capacitor/core';
import { useEffect, useRef, useState } from 'preact/hooks';
import { addDays, today, weekStart } from './core/dates';
import type { Item, Kind, PersonId } from './core/types';
import { haptic } from './haptics';
import { parseLink } from './links';
import type { CalView, Tab } from './nav';
import { dismissNotice, sync as syncNow, undoLast, updateSettings, useStore } from './store';
import { CalNav } from './ui/CalNav';
import { sheetStack } from './ui/common';
import { DaySheet } from './ui/DaySheet';
import { EditSheet, KindPicker } from './ui/EditSheet';
import { Home } from './ui/Home';
import { Ic, type IconName } from './ui/icons';
import { More } from './ui/More';
import { ScrollTop } from './ui/ScrollTop';
import { SearchSheet } from './ui/SearchSheet';
import { Settings } from './ui/Settings';
import { Shop } from './ui/Shop';
import { Tasks } from './ui/Tasks';
import { Timeline } from './ui/Timeline';
import { Vacation } from './ui/Vacation';
import { Week } from './ui/Week';
import { Year, type PlanPreset } from './ui/Year';

const TITLES: Record<Tab, string> = {
  home: 'Familienplaner',
  cal: 'Kalender',
  vacation: 'Urlaubsverwaltung',
  shop: 'Einkaufsliste',
  more: 'Mehr',
  tasks: 'Aufgaben & Geburtstage',
  settings: 'Einstellungen',
};
/** Wohin führt „zurück“, wenn es keinen Verlauf gibt? */
const PARENT: Record<Tab, Tab | null> = { home: null, cal: 'home', vacation: 'home', shop: 'home', more: 'home', tasks: 'more', settings: 'more' };

type Sheet =
  | null
  | { t: 'day'; date: string }
  | { t: 'pick'; date?: string }
  | { t: 'search' }
  | { t: 'edit'; item: Partial<Item> & { kind: Kind } };

export function App() {
  const { sync, undo, notice, settings, readOnly, items, cal } = useStore();
  const [tab, setTab] = useState<Tab>('home');
  const [stack, setStack] = useState<Tab[]>([]); // Verlauf für „zurück“
  const [weekOf, setWeekOf] = useState(weekStart(today()));
  const [year, setYear] = useState(Number(today().slice(0, 4))); // Start immer mit Fokus auf heute
  const [sheet, setSheet] = useState<Sheet>(null);
  const [preset, setPreset] = useState<PlanPreset | undefined>();
  const [focusShop, setFocusShop] = useState(0);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const calView = settings.calView;
  const close = () => setSheet(null);
  const edit = (item: Item) => !readOnly && setSheet({ t: 'edit', item });
  const openDay = (date: string) => setSheet({ t: 'day', date });
  const addAt = (kind: Kind, date: string) => !readOnly && setSheet({ t: 'edit', item: { kind, start: date, end: date } });

  /* ---------- Navigation mit Verlauf ---------- */
  const nav = (t: Tab) => {
    if (t === tab) return;
    setStack((s) => (t === 'home' ? [] : [...s.slice(-19), tab]));
    setTab(t);
  };
  const go = (t: Tab) => {
    if (t === tab) return void window.scrollTo({ top: 0, behavior: 'smooth' }); // aktiven Tab nochmal tippen = nach oben
    if (t === 'cal' && calView === 'week') setWeekOf(weekStart(today()));
    nav(t);
  };
  const back = () => {
    if (stack.length) {
      setTab(stack[stack.length - 1]);
      setStack((s) => s.slice(0, -1));
    } else if (PARENT[tab]) setTab(PARENT[tab]!);
  };
  const setView = (v: CalView) => updateSettings({ calView: v });

  // Planen = Jahresplaner mit vorgewähltem Zeitraum/Personen öffnen
  const plan = (days?: string[], persons?: PersonId[]) => {
    if (readOnly) return;
    const start = days?.[0];
    const end = days && days.length > 1 ? days[days.length - 1] : undefined;
    if (start) setYear(Number(start.slice(0, 4)));
    setPreset({ id: Date.now(), start, end, persons });
    setView('year');
    setSheet(null);
    nav('cal');
  };
  const goWeek = (d: string) => {
    setWeekOf(weekStart(d));
    setView('week');
    nav('cal');
    close();
  };

  /* ---------- Direktlinks (Widget-Kreise, Launcher-Schnellaktionen) ---------- */
  const linkRef = useRef<(url: string) => void>(() => {});
  linkRef.current = (url: string) => {
    const l = parseLink(url);
    if (!l) return;
    setSheet(null);
    if (l.type === 'tab') nav(l.tab);
    else if (l.type === 'today') {
      setWeekOf(weekStart(today()));
      setView('week');
      nav('cal');
    } else if (l.type === 'day') {
      setWeekOf(weekStart(l.date));
      setView('week');
      nav('cal');
      openDay(l.date);
    } else if (l.what === 'shop') {
      nav('shop');
      setFocusShop((n) => n + 1);
    } else if (!readOnly) {
      nav(l.what === 'task' ? 'tasks' : 'cal');
      setSheet({ t: 'edit', item: { kind: l.what, start: today(), end: today() } });
    }
  };

  /* ---------- Android: Zurück-Taste und Direktlinks ---------- */
  const backRef = useRef(back);
  backRef.current = back;
  const stateRef = useRef({ tab, stack });
  stateRef.current = { tab, stack };
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handles: { remove: () => void }[] = [];
    let gone = false;
    void import('@capacitor/app').then(async ({ App: CapApp }) => {
      const add = async <T,>(h: Promise<{ remove: () => void }> | { remove: () => void } | T) => {
        const handle = (await h) as { remove: () => void };
        if (gone) handle.remove();
        else handles.push(handle);
      };
      await add(
        CapApp.addListener('backButton', () => {
          const top = sheetStack[sheetStack.length - 1];
          if (top) return top();
          const { tab: tb, stack: st } = stateRef.current;
          if (st.length || PARENT[tb]) return backRef.current();
          void CapApp.exitApp();
        }),
      );
      await add(CapApp.addListener('appUrlOpen', (e) => linkRef.current(e.url)));
      const launch = await CapApp.getLaunchUrl();
      if (launch?.url) linkRef.current(launch.url);
    });
    return () => {
      gone = true;
      handles.forEach((h) => h.remove());
    };
  }, []);

  /* ---------- Merken, wo du warst: Scrollposition je Ansicht ---------- */
  const viewKey = tab === 'cal' ? `cal:${calView}` : tab;
  const keyRef = useRef(viewKey);
  const switching = useRef(false);
  const saved = useRef<Record<string, number>>({});
  if (keyRef.current !== viewKey) {
    switching.current = true; // Scroll-Ereignisse beim Umschalten nicht als Nutzer-Scrollen werten
    keyRef.current = viewKey;
  }
  useEffect(() => {
    const on = () => {
      if (!switching.current) saved.current[keyRef.current] = window.scrollY;
    };
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  useEffect(() => {
    if (!switching.current) return;
    const y = saved.current[viewKey];
    // Erstes Öffnen: die Ansicht entscheidet selbst (z. B. Verlauf/Jahr scrollen zu heute).
    // Wiederkehr: gemerkte Position – kurz nach den Ansichten, damit sie ihr eigenes Scrollen überschreibt.
    const id = setTimeout(() => {
      if (y !== undefined) window.scrollTo(0, y);
      switching.current = false;
    }, y === undefined ? 200 : 160);
    return () => clearTimeout(id);
  }, [viewKey]);

  /* ---------- Wischen vom linken Rand = zurück · Herunterziehen = abgleichen ---------- */
  const touch = useRef<{ x: number; y: number; top: boolean; edge: boolean } | null>(null);
  const pullRef = useRef(0);
  const doRefresh = async () => {
    if (!settings.server || !settings.code) return;
    setRefreshing(true);
    await syncNow();
    haptic('success');
    setTimeout(() => setRefreshing(false), 400);
  };

  const showFab = !readOnly && ((tab === 'cal' && calView !== 'year') || tab === 'tasks' || tab === 'vacation');

  /* ---------- Zahlen an den Tabs ---------- */
  const t0 = today();
  const shopOpen = items.filter((i) => i.kind === 'shop' && !i.deleted && !i.done).length;
  const overdue = items.filter((i) => i.kind === 'task' && !i.deleted && !i.done && i.start < t0).length;
  const gapToday = cal.day(t0).coverage === 'gap' || cal.day(addDays(t0, 1)).coverage === 'gap';
  const navActive: Tab = tab === 'tasks' || tab === 'settings' ? 'more' : tab;
  const parent = stack.length ? stack[stack.length - 1] : PARENT[tab];

  return (
    <div
      class="app"
      onTouchStart={(e) => {
        if (sheetStack.length) return;
        const p = e.touches[0];
        touch.current = { x: p.clientX, y: p.clientY, top: window.scrollY <= 0, edge: p.clientX < 22 };
      }}
      onTouchMove={(e) => {
        const c = touch.current;
        if (!c || !c.top || refreshing) return;
        const p = e.touches[0];
        const dy = p.clientY - c.y;
        const dx = p.clientX - c.x;
        if (dy > 8 && Math.abs(dx) < dy && !c.edge) {
          pullRef.current = Math.min(dy * 0.5, 64);
          setPull(pullRef.current);
        }
      }}
      onTouchEnd={(e) => {
        const c = touch.current;
        touch.current = null;
        if (!c) return;
        const p = e.changedTouches[0];
        const dx = p.clientX - c.x;
        const dy = p.clientY - c.y;
        if (c.edge && dx > 80 && Math.abs(dy) < 60) back();
        else if (pullRef.current >= 44) void doRefresh();
        pullRef.current = 0;
        setPull(0);
      }}
    >
      <header class="top">
        {parent && <button class="back" onClick={back} aria-label="Zurück"><Ic n="left" size={24} sw={2.5} /></button>}
        <h1>{TITLES[tab]}</h1>
        <span class="grow" />
        {readOnly && <span class="ro-badge"><Ic n="eye" size={13} /> nur Lesen</span>}
        <span class={`sync sync-${sync.status}`} title={sync.msg ?? sync.status}>
          {sync.status === 'off' ? 'lokal' : sync.status === 'syncing' ? 'synchronisiere …' : sync.status === 'error' ? <><Ic n="warn" size={13} /> {sync.msg?.includes('Code') ? 'Code falsch' : 'offline'}</> : <><Ic n="check" size={13} /> synchron</>}
        </span>
        <button class="hdr-btn" onClick={() => setSheet({ t: 'search' })} aria-label="Suchen und springen"><Ic n="search" size={20} /></button>
      </header>

      <div class={`ptr ${pull > 0 || refreshing ? 'show' : ''}`} style={{ height: refreshing ? 40 : pull }}>
        <Ic n="refresh" size={16} class={refreshing || sync.status === 'syncing' ? 'spin' : ''} />
        <span>{refreshing ? 'Gleiche ab …' : pull >= 44 ? 'Loslassen zum Abgleichen' : 'Zum Abgleichen ziehen'}</span>
      </div>

      <main key={tab}>
        {tab === 'home' && <Home go={go} openDay={openDay} add={() => setSheet({ t: 'pick' })} />}
        {tab === 'cal' && (
          <>
            <CalNav />
            {(calView === 'week' || calView === 'day') && <Week weekOf={weekOf} setWeekOf={setWeekOf} openDay={openDay} edit={edit} plan={plan} add={addAt} />}
            {calView === 'timeline' && <Timeline openDay={openDay} />}
            {calView === 'year' && <Year year={year} setYear={setYear} openDay={openDay} preset={preset} />}
          </>
        )}
        {tab === 'vacation' && <Vacation year={year} setYear={setYear} goWeek={goWeek} plan={plan} />}
        {tab === 'shop' && <Shop focusSignal={focusShop} />}
        {tab === 'more' && <More go={go} />}
        {tab === 'tasks' && <Tasks edit={edit} add={() => setSheet({ t: 'edit', item: { kind: 'task' } })} />}
        {tab === 'settings' && <Settings />}
      </main>

      {(tab === 'cal' || tab === 'vacation') && <ScrollTop key={tab} />}

      {showFab && <button class="fab" aria-label="Neuer Eintrag" onClick={() => setSheet({ t: 'pick' })}><Ic n="plus" size={28} sw={2.5} /></button>}

      {notice && (
        <div class="notice" key={notice.id} onClick={() => { if (notice.date) openDay(notice.date); dismissNotice(); }}>
          <Ic n="bell" size={18} />
          <div class="grow">
            <b>{notice.title}</b>
            {notice.lines.map((l) => <div key={l}>{l}</div>)}
          </div>
          <button aria-label="Schließen" onClick={(e) => { e.stopPropagation(); dismissNotice(); }}><Ic n="x" size={16} /></button>
        </div>
      )}

      {undo && (
        <div class="snack" key={undo.id}>
          <span>{undo.label}</span>
          <button onClick={undoLast}><Ic n="undo" size={15} /> Rückgängig</button>
        </div>
      )}

      <nav class="tabs">
        <TabBtn on={navActive === 'cal'} icon="week" label="Kalender" dot={gapToday} onClick={() => go('cal')} />
        <TabBtn on={navActive === 'vacation'} icon="palm" label="Urlaub" onClick={() => go('vacation')} />
        <button class={`home-btn ${navActive === 'home' ? 'on' : ''}`} onClick={() => go('home')} aria-label="Startseite">
          <span><Ic n="home" size={26} /></span>
        </button>
        <TabBtn on={navActive === 'shop'} icon="cart" label="Einkauf" count={shopOpen} onClick={() => go('shop')} />
        <TabBtn on={navActive === 'more'} icon="menu" label="Mehr" count={overdue} red onClick={() => go('more')} />
      </nav>

      {sheet?.t === 'day' && <DaySheet date={sheet.date} onClose={close} edit={edit} add={addAt} plan={(d) => plan([d])} />}
      {sheet?.t === 'search' && (
        <SearchSheet
          onClose={close}
          onDay={(d) => { setWeekOf(weekStart(d)); openDay(d); }}
          onGo={(t, v) => {
            if (v) setView(v);
            if (t === 'cal') setWeekOf(weekStart(today()));
            nav(t);
          }}
        />
      )}
      {sheet?.t === 'pick' && (
        <KindPicker
          onClose={close}
          onPick={(kind) => setSheet({ t: 'edit', item: { kind, ...(sheet.date ? { start: sheet.date, end: sheet.date } : tab === 'cal' ? { start: today(), end: today() } : {}) } })}
          onPlan={() => plan()}
          onShop={() => { close(); nav('shop'); setFocusShop((n) => n + 1); }}
        />
      )}
      {sheet?.t === 'edit' && <EditSheet key={sheet.item.id ?? 'new'} initial={sheet.item} onClose={close} />}
    </div>
  );
}

function TabBtn({ on, icon, label, onClick, count, dot, red }: { on: boolean; icon: IconName; label: string; onClick: () => void; count?: number; dot?: boolean; red?: boolean }) {
  return (
    <button class={on ? 'on' : ''} onClick={onClick}>
      <span class="tab-ic">
        <Ic n={icon} size={22} sw={on ? 2.4 : 2} />
        {count !== undefined && count > 0 && <i class={`tab-badge ${red ? 'red' : ''}`}>{count > 99 ? '99+' : count}</i>}
        {dot && <i class="tab-dot" />}
      </span>
      {label}
    </button>
  );
}
