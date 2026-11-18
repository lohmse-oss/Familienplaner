import type { CalView } from '../nav';
import { updateSettings, useStore } from '../store';
import { PersonFilterBar } from './common';
import { LayerMenu } from './LayerMenu';
import { Ic, type IconName } from './icons';

const VIEWS: { v: CalView; label: string; icon: IconName }[] = [
  { v: 'day', label: 'Tag', icon: 'clock' },
  { v: 'week', label: 'Woche', icon: 'week' },
  { v: 'year', label: 'Jahr', icon: 'year' },
  { v: 'timeline', label: 'Verlauf', icon: 'rows' },
];

/** Kopf aller Kalenderansichten: Ansicht wählen (Tag · Woche · Jahr · Verlauf) und Personenfilter. */
export function CalNav() {
  const { settings } = useStore();
  return (
    <div class="cal-head">
      <div class="seg-ctl wide" role="group" aria-label="Kalenderansicht">
        {VIEWS.map((x) => (
          <button key={x.v} class={settings.calView === x.v ? 'on' : ''} onClick={() => updateSettings({ calView: x.v })}>
            <Ic n={x.icon} size={15} /> {x.label}
          </button>
        ))}
      </div>
      <div class="filter-row">
        <PersonFilterBar />
        <LayerMenu />
      </div>
    </div>
  );
}
