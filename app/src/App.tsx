import { useState } from 'preact/hooks';
import { planningYear, today, weekStart } from './core/dates';
import type { Item, Kind } from './core/types';
import { useStore } from './store';
import { DaySheet } from './ui/DaySheet';
import { EditSheet, KindPicker } from './ui/EditSheet';
import { Settings } from './ui/Settings';
import { Tasks } from './ui/Tasks';
import { Vacation } from './ui/Vacation';
import { Week } from './ui/Week';
import { Year } from './ui/Year';

type Tab = 'week' | 'year' | 'vacation' | 'tasks' | 'settings';
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'week', label: 'Woche', icon: '📅' },
  { id: 'year', label: 'Jahr', icon: '🗓️' },
  { id: 'vacation', label: 'Urlaub', icon: '🌴' },
  { id: 'tasks', label: 'Aufgaben', icon: '☑' },
  { id: 'settings', label: 'Mehr', icon: '⚙️' },
];

type Sheet =
  | null
  | { t: 'day'; date: string }
  | { t: 'pick'; date?: string }
  | { t: 'edit'; item: Partial<Item> & { kind: Kind } };

export function App() {
  const { sync } = useStore();
  const [tab, setTab] = useState<Tab>('week');
  const [weekOf, setWeekOf] = useState(weekStart(today()));
  const [year, setYear] = useState(planningYear());
  const [sheet, setSheet] = useState<Sheet>(null);
  const close = () => setSheet(null);
  const edit = (item: Item) => setSheet({ t: 'edit', item });
  const goWeek = (d: string) => {
    setWeekOf(weekStart(d));
    setTab('week');
    close();
  };

  return (
    <div class="app">
      <header class="top">
        <h1>Familienplaner</h1>
        <span class={`sync sync-${sync.status}`} title={sync.msg ?? sync.status}>
          {sync.status === 'off' ? 'lokal' : sync.status === 'syncing' ? '⟳' : sync.status === 'error' ? (sync.msg?.includes('Code') ? '⚠ Code falsch' : '⚠ offline') : '✓ synchron'}
        </span>
      </header>

      <main>
        {tab === 'week' && <Week weekOf={weekOf} setWeekOf={setWeekOf} openDay={(date) => setSheet({ t: 'day', date })} edit={edit} />}
        {tab === 'year' && <Year year={year} setYear={setYear} openDay={(date) => setSheet({ t: 'day', date })} goWeek={goWeek} />}
        {tab === 'vacation' && <Vacation year={year} setYear={setYear} goWeek={goWeek} />}
        {tab === 'tasks' && <Tasks edit={edit} />}
        {tab === 'settings' && <Settings />}
      </main>

      {tab !== 'settings' && (
        <button class="fab" aria-label="Neuer Eintrag" onClick={() => setSheet({ t: 'pick' })}>＋</button>
      )}

      <nav class="tabs">
        {TABS.map((x) => (
          <button key={x.id} class={tab === x.id ? 'on' : ''} onClick={() => setTab(x.id)}>
            <span>{x.icon}</span>
            {x.label}
          </button>
        ))}
      </nav>

      {sheet?.t === 'day' && (
        <DaySheet
          date={sheet.date}
          onClose={close}
          edit={edit}
          add={(kind, date) => setSheet({ t: 'edit', item: { kind, start: date, end: date } })}
        />
      )}
      {sheet?.t === 'pick' && (
        <KindPicker onClose={close} onPick={(kind) => setSheet({ t: 'edit', item: { kind, ...(sheet.date ? { start: sheet.date, end: sheet.date } : tab === 'week' ? { start: today(), end: today() } : {}) } })} />
      )}
      {sheet?.t === 'edit' && <EditSheet key={sheet.item.id ?? 'new'} initial={sheet.item} onClose={close} />}
    </div>
  );
}
