import { useState } from 'preact/hooks';
import { planningYear, today, weekStart } from './core/dates';
import type { Item, Kind, PersonId } from './core/types';
import type { Tab } from './nav';
import { undoLast, useStore } from './store';
import { DaySheet } from './ui/DaySheet';
import { EditSheet, KindPicker } from './ui/EditSheet';
import { Home } from './ui/Home';
import { Settings } from './ui/Settings';
import { Shop } from './ui/Shop';
import { Tasks } from './ui/Tasks';
import { Vacation } from './ui/Vacation';
import { Week } from './ui/Week';
import { Year, type PlanPreset } from './ui/Year';

const TITLES: Record<Tab, string> = {
  home: 'Familienplaner',
  week: 'Wochenplan',
  year: 'Jahresplaner',
  vacation: 'Urlaubsverwaltung',
  shop: 'Einkaufsliste',
  tasks: 'Aufgaben & Geburtstage',
  settings: 'Einstellungen',
};

type Sheet =
  | null
  | { t: 'day'; date: string }
  | { t: 'pick'; date?: string }
  | { t: 'edit'; item: Partial<Item> & { kind: Kind } };

export function App() {
  const { sync, undo } = useStore();
  const [tab, setTab] = useState<Tab>('home');
  const [weekOf, setWeekOf] = useState(weekStart(today()));
  const [year, setYear] = useState(planningYear());
  const [sheet, setSheet] = useState<Sheet>(null);
  const [preset, setPreset] = useState<PlanPreset | undefined>();
  const close = () => setSheet(null);
  const edit = (item: Item) => setSheet({ t: 'edit', item });
  const openDay = (date: string) => setSheet({ t: 'day', date });
  // Planen = Jahresplaner mit vorgewähltem Zeitraum/Personen öffnen
  const plan = (days?: string[], persons?: PersonId[]) => {
    const start = days?.[0];
    const end = days && days.length > 1 ? days[days.length - 1] : undefined;
    if (start) setYear(Number(start.slice(0, 4)));
    setPreset({ id: Date.now(), start, end, persons });
    setSheet(null);
    setTab('year');
  };
  const goWeek = (d: string) => {
    setWeekOf(weekStart(d));
    setTab('week');
    close();
  };
  const go = (t: Tab) => {
    if (t === 'week') setWeekOf(weekStart(today()));
    setTab(t);
  };
  const showFab = tab === 'week' || tab === 'tasks';

  return (
    <div class="app">
      <header class="top">
        {tab !== 'home' && <button class="back" onClick={() => go('home')} aria-label="Startseite">‹</button>}
        <h1>{TITLES[tab]}</h1>
        <span class="grow" />
        <span class={`sync sync-${sync.status}`} title={sync.msg ?? sync.status}>
          {sync.status === 'off' ? 'lokal' : sync.status === 'syncing' ? '⟳' : sync.status === 'error' ? (sync.msg?.includes('Code') ? '⚠ Code falsch' : '⚠ offline') : '✓ synchron'}
        </span>
      </header>

      <main>
        {tab === 'home' && <Home go={go} openDay={openDay} add={() => setSheet({ t: 'pick' })} />}
        {tab === 'week' && <Week weekOf={weekOf} setWeekOf={setWeekOf} openDay={openDay} edit={edit} plan={plan} />}
        {tab === 'year' && <Year year={year} setYear={setYear} openDay={openDay} preset={preset} />}
        {tab === 'vacation' && <Vacation year={year} setYear={setYear} goWeek={goWeek} plan={plan} />}
        {tab === 'shop' && <Shop />}
        {tab === 'tasks' && <Tasks edit={edit} />}
        {tab === 'settings' && <Settings />}
      </main>

      {showFab && <button class="fab" aria-label="Neuer Eintrag" onClick={() => setSheet({ t: 'pick' })}>＋</button>}

      {undo && (
        <div class="snack" key={undo.id}>
          <span>{undo.label}</span>
          <button onClick={undoLast}>Rückgängig</button>
        </div>
      )}

      <nav class="tabs">
        <TabBtn on={tab === 'week'} icon="📅" label="Woche" onClick={() => go('week')} />
        <TabBtn on={tab === 'year'} icon="🗓️" label="Jahr" onClick={() => go('year')} />
        <button class={`home-btn ${tab === 'home' ? 'on' : ''}`} onClick={() => go('home')} aria-label="Startseite">
          <span>🏠</span>
        </button>
        <TabBtn on={tab === 'vacation'} icon="🌴" label="Urlaub" onClick={() => go('vacation')} />
        <TabBtn on={tab === 'shop'} icon="🛒" label="Einkauf" onClick={() => go('shop')} />
      </nav>

      {sheet?.t === 'day' && (
        <DaySheet date={sheet.date} onClose={close} edit={edit} add={(kind, date) => setSheet({ t: 'edit', item: { kind, start: date, end: date } })} plan={(d) => plan([d])} />
      )}
      {sheet?.t === 'pick' && (
        <KindPicker onClose={close} onPick={(kind) => setSheet({ t: 'edit', item: { kind, ...(sheet.date ? { start: sheet.date, end: sheet.date } : tab === 'week' ? { start: today(), end: today() } : {}) } })} onPlan={() => plan()} />
      )}
      {sheet?.t === 'edit' && <EditSheet key={sheet.item.id ?? 'new'} initial={sheet.item} onClose={close} />}
    </div>
  );
}

function TabBtn({ on, icon, label, onClick }: { on: boolean; icon: string; label: string; onClick: () => void }) {
  return (
    <button class={on ? 'on' : ''} onClick={onClick}>
      <span>{icon}</span>
      {label}
    </button>
  );
}
