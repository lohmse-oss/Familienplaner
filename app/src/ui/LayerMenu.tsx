import { useState } from 'preact/hooks';
import type { Layers } from '../core/layers';
import { updateSettings, useStore } from '../store';
import { Ic, type IconName } from './icons';

const ROWS: { k: keyof Layers; label: string; icon: IconName }[] = [
  { k: 'birthdays', label: 'Geburtstage', icon: 'cake' },
  { k: 'tasks', label: 'Aufgaben (Fälligkeit)', icon: 'tasks' },
  { k: 'events', label: 'Termine & Events', icon: 'addcal' },
];

/** Knopf „Ebenen“: blendet Geburtstage, Aufgaben und Termine im Kalender ein oder aus. */
export function LayerMenu() {
  const { settings } = useStore();
  const [open, setOpen] = useState(false);
  const off = ROWS.filter((r) => !settings.layers[r.k]).length;
  return (
    <div class="layer-menu">
      <button class={`icon-btn ${off ? 'has-off' : ''}`} onClick={() => setOpen(!open)} aria-label="Ebenen im Kalender" aria-expanded={open}>
        <Ic n="layers" size={20} />
        {off > 0 && <i class="layer-dot" />}
      </button>
      {open && (
        <>
          <div class="layer-backdrop" onClick={() => setOpen(false)} />
          <div class="layer-pop" role="menu">
            <b>Im Kalender anzeigen</b>
            {ROWS.map((r) => (
              <label key={r.k} class="layer-row">
                <input type="checkbox" checked={settings.layers[r.k]} onChange={(e) => updateSettings({ layers: { ...settings.layers, [r.k]: (e.target as HTMLInputElement).checked } })} />
                <Ic n={r.icon} size={16} class="muted" /> {r.label}
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
