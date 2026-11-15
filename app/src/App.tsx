import { Capacitor } from '@capacitor/core';
import { useEffect, useRef, useState } from 'preact/hooks';
import { today, weekStart } from './core/dates';
import type { Item, Kind, PersonId } from './core/types';
import type { Tab } from './nav';
import { dismissNotice, undoLast, updateSettings, useStore } from './store';
import { CalNav } from './ui/CalNav';
import { sheetStack } from './ui/common';
import { DaySheet } from './ui/DaySheet';
import { EditSheet, KindPicker } from './ui/EditSheet';
import { Home } from './ui/Home';
import { Ic, type IconName } from './ui/icons';
import { More } from './ui/More';
import { ScrollTop } from './ui/ScrollTop';
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
/** Wohin führt „zurück“? */
const PARENT: Record<Tab, Tab | null> = { home: null, cal: 'home', vacation: 'home', shop: 'home', more: 'home', tasks: 'more', settings: 'more' };

type Sheet =
  | null
  | { t: 'day'; date: string }
  | { t: 'pick'; date?: string }
  | { t: 'edit'; item: Partial<Item> & { kind: Kind } };

export function App() {
  const { sync, undo, notice, settings, readOnly } = useStore();
  const [tab, setTab] = useState<Tab>('home');
  const [weekOf, setWeekOf] = useState(weekStart(today()));
  const [year, setYear] = useState(Number(today().slice(0, 4))); // Start immer mit Fokus auf heute
  const [sheet, setSheet] = useState<Sheet>(null);
  const [preset, setPreset] = useState<PlanPreset | undefined>();
  const close = () => setSheet(null);
  const edit = (item: Item) => !readOnly && setSheet({ t: 'edit', item });
  const openDay = (date: string) => setSheet({ t: 'day', date });
  const addAt = (kind: Kind, date: string) => !readOnly && setSheet({ t: 'edit', item: { kind, start: date, end: date } });

  // Planen = Jahresplaner mit vorgewähltem Zeitraum/Personen öffnen
  const plan = (days?: string[], persons?: PersonId[]) => {
    if (readOnly) return;
    const start = days?.[0];
    const end = days && days.length > 1 ? days[days.length - 1] : undefined;
    if (start) setYear(Number(start.slice(0, 4)));
    setPreset({ id: Date.now(), start, end, persons });
    updateSettings({ calView: 'year' });
    setSheet(null);
    setTab('cal');
  };
  const goWeek = (d: string) => {
    setWeekOf(weekStart(d));
    updateSettings({ calView: 'week' });
    setTab('cal');
    close();
  };
  const go = (t: Tab) => {
    if (t === 'cal' && settings.calView === 'week') setWeekOf(weekStart(today()));
    setTab(t);
  };
  const showFab = !readOnly && (tab === 'tasks' || (tab === 'cal' && (settings.calView === 'week' || settings.calView === 'day')));
  const navActive: Tab = tab === 'tasks' || tab === 'settings' ? 'more' : tab;

  // Android-Zurück-Taste: oberstes Fenster schließen, sonst eine Ebene zurück, auf der Startseite App beenden
  const tabRef = useRef(tab);
  tabRef.current = tab;
  const goRef = useRef(go);
  goRef.current = go;
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let handle: { remove: () => void } | undefined;
    let gone = false;
    void import('@capacitor/app').then(async ({ App: CapApp }) => {
      const h = await CapApp.addListener('backButton', () => {
        const top = sheetStack[sheetStack.length - 1];
        if (top) return top();
        const parent = PARENT[tabRef.current];
        if (parent) return goRef.current(parent);
        void CapApp.exitApp();
      });
      if (gone) h.remove();
      else handle = h;
    });
    return () => {
      gone = true;
      handle?.remove();
    };
  }, []);

  const parent = PARENT[tab];
  const calView = settings.calView;

  return (
    <div class="app">
      <header class="top">
        {parent && <button class="back" onClick={() => go(parent)} aria-label="Zurück"><Ic n="left" size={24} sw={2.5} /></button>}
        <h1>{TITLES[tab]}</h1>
        <span class="grow" />
        {readOnly && <span class="ro-badge"><Ic n="eye" size={13} /> nur Lesen</span>}
        <span class={`sync sync-${sync.status}`} title={sync.msg ?? sync.status}>
          {sync.status === 'off' ? 'lokal' : sync.status === 'syncing' ? 'synchronisiere …' : sync.status === 'error' ? <><Ic n="warn" size={13} /> {sync.msg?.includes('Code') ? 'Code falsch' : 'offline'}</> : <><Ic n="check" size={13} /> synchron</>}
        </span>
      </header>

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
        {tab === 'shop' && <Shop />}
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
        <TabBtn on={navActive === 'cal'} icon="week" label="Kalender" onClick={() => go('cal')} />
        <TabBtn on={navActive === 'vacation'} icon="palm" label="Urlaub" onClick={() => go('vacation')} />
        <button class={`home-btn ${navActive === 'home' ? 'on' : ''}`} onClick={() => go('home')} aria-label="Startseite">
          <span><Ic n="home" size={26} /></span>
        </button>
        <TabBtn on={navActive === 'shop'} icon="cart" label="Einkauf" onClick={() => go('shop')} />
        <TabBtn on={navActive === 'more'} icon="menu" label="Mehr" onClick={() => go('more')} />
      </nav>

      {sheet?.t === 'day' && <DaySheet date={sheet.date} onClose={close} edit={edit} add={addAt} plan={(d) => plan([d])} />}
      {sheet?.t === 'pick' && (
        <KindPicker onClose={close} onPick={(kind) => setSheet({ t: 'edit', item: { kind, ...(sheet.date ? { start: sheet.date, end: sheet.date } : tab === 'cal' ? { start: today(), end: today() } : {}) } })} onPlan={() => plan()} />
      )}
      {sheet?.t === 'edit' && <EditSheet key={sheet.item.id ?? 'new'} initial={sheet.item} onClose={close} />}
    </div>
  );
}

function TabBtn({ on, icon, label, onClick }: { on: boolean; icon: IconName; label: string; onClick: () => void }) {
  return (
    <button class={on ? 'on' : ''} onClick={onClick}>
      <span><Ic n={icon} size={22} sw={on ? 2.4 : 2} /></span>
      {label}
    </button>
  );
}
