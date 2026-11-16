import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Coverage, ParentStatus } from '../core/calendar';
import { ALL, PERSONS, type PersonId } from '../core/types';
import { updateSettings, useStore } from '../store';
import { Ic } from './icons';

export const STATUS_LABEL: Record<ParentStatus, string> = {
  free: 'frei',
  office: 'Büro',
  homeoffice: 'Homeoffice',
  vacation: 'Urlaub',
  trip: 'Dienstreise',
};
export const COVERAGE_LABEL: Record<Coverage, string> = {
  none: '',
  ok: 'Betreuung gesichert',
  maybe: 'Betreuung nur per Homeoffice',
  gap: 'Betreuung ungeklärt',
};

export const Dot = ({ p }: { p: PersonId }) => <span class="dot" style={{ background: PERSONS[p].color }} title={PERSONS[p].name} />;

export const PersonTag = ({ p }: { p: PersonId }) => (
  <span class="ptag" style={{ background: PERSONS[p].soft, color: PERSONS[p].color }}>
    {PERSONS[p].name}
  </span>
);

export function Pill({ coverage }: { coverage: Coverage }) {
  if (coverage === 'none') return null;
  return <span class={`pill pill-${coverage}`}>{COVERAGE_LABEL[coverage]}</span>;
}

export function Chips<T extends string>(props: {
  options: { value: T; label: ComponentChildren; color?: string }[];
  value: T[];
  onChange: (v: T[]) => void;
  multi?: boolean;
}) {
  return (
    <div class="chips">
      {props.options.map((o) => {
        const on = props.value.includes(o.value);
        return (
          <button
            type="button"
            class={`chip ${on ? 'on' : ''}`}
            style={on && o.color ? { background: o.color, borderColor: o.color, color: '#fff' } : undefined}
            onClick={() =>
              props.onChange(props.multi ? (on ? props.value.filter((v) => v !== o.value) : [...props.value, o.value]) : [o.value])
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Personenfilter für Woche, Jahr und Aufgaben (gilt app-weit, bleibt gespeichert). */
/** Personenfilter mit Mehrfachauswahl: mehrere Familienmitglieder gleichzeitig wählbar, „Alle“ setzt zurück. */
export function PersonFilterBar() {
  const { settings } = useStore();
  const f = settings.filter;
  const sel = f === 'all' ? ALL : f;
  const toggle = (p: PersonId) => {
    const next = sel.includes(p) ? sel.filter((x) => x !== p) : [...sel, p];
    updateSettings({ filter: next.length === 0 || next.length === ALL.length ? 'all' : next });
  };
  return (
    <div class="pfilter" role="group" aria-label="Personenfilter">
      <button class={`pf ${f === 'all' ? 'on' : ''}`} style={f === 'all' ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff' } : undefined} onClick={() => updateSettings({ filter: 'all' })}>
        Alle
      </button>
      {ALL.map((p) => {
        const on = sel.includes(p);
        return (
          <button key={p} class={`pf ${on ? 'on' : ''}`} style={on ? { background: PERSONS[p].color, borderColor: PERSONS[p].color, color: '#fff' } : undefined} onClick={() => toggle(p)}>
            {!on && <span class="dot" style={{ background: PERSONS[p].color }} />}
            {PERSONS[p].name}
          </button>
        );
      })}
    </div>
  );
}

/** Offene Fenster, damit die Android-Zurück-Taste das oberste schließt. */
export const sheetStack: (() => void)[] = [];

/**
 * Bottom-Sheet: Griff, Wischen nach unten schließt, weiches Ein-/Ausblenden.
 * Gezogen wird am Kopfbereich (Griff + Titel), damit der Inhalt normal scrollbar bleibt.
 */
export function Sheet(props: { title: string; onClose: () => void; children: ComponentChildren; tall?: boolean; footer?: ComponentChildren }) {
  const [dy, setDy] = useState(0);
  const [drag, setDrag] = useState(false);
  const [closing, setClosing] = useState(false);
  const start = useRef<{ y: number; t: number } | null>(null);
  const onClose = useRef(props.onClose);
  onClose.current = props.onClose;
  const close = useRef(() => {
    setClosing(true);
    setTimeout(() => onClose.current(), 170);
  }).current;

  useEffect(() => {
    sheetStack.push(close);
    return () => {
      const i = sheetStack.indexOf(close);
      if (i >= 0) sheetStack.splice(i, 1);
    };
  }, []);

  const down = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    start.current = { y: e.clientY, t: Date.now() };
    setDrag(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent) => {
    if (start.current) setDy(Math.max(0, e.clientY - start.current.y));
  };
  const up = (e: PointerEvent) => {
    if (!start.current) return;
    const d = Math.max(0, e.clientY - start.current.y);
    const v = d / (Date.now() - start.current.t + 1);
    start.current = null;
    setDrag(false);
    if (d > 110 || (d > 40 && v > 0.5)) close();
    else setDy(0);
  };

  return (
    <div class="backdrop" style={{ opacity: closing ? 0 : 1 - Math.min(dy / 500, 0.5), transition: drag ? 'none' : 'opacity .17s' }} onClick={close}>
      <div
        class={`sheet ${props.tall ? 'tall' : ''}`}
        style={{ transform: closing ? 'translateY(105%)' : `translateY(${dy}px)`, transition: drag ? 'none' : 'transform .17s ease-out' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div class="sheet-grab" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          <i class="grip" />
          <div class="sheet-head">
            <h2>{props.title}</h2>
            <button class="icon-btn" onClick={close} aria-label="Schließen"><Ic n="x" /></button>
          </div>
        </div>
        <div class="sheet-body">{props.children}</div>
        {props.footer && <div class="sheet-foot">{props.footer}</div>}
      </div>
    </div>
  );
}
