import type { CalView } from '../nav';
import { updateSettings, useStore } from '../store';
import { PersonFilterBar } from './common';
import { Ic, type IconName } from './icons';

const VIEWS: { v: CalView; label: string; icon: IconName }[] = [
  { v: 'week', label: 'Woche', icon: 'week' },
  { v: 'day', label: 'Tag', icon: 'clock' },
  { v: 'timeline', label: 'Verlauf', icon: 'rows' },
  { v: 'year', label: 'Jahr', icon: 'year' },
];

/** Kopf aller Kalenderansichten: Ansicht wählen (Woche · Tag · Verlauf · Jahr) und Personenfilter. */
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
      <PersonFilterBar />
    </div>
  );
}
