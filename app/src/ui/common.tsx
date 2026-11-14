import type { ComponentChildren } from 'preact';
import { PERSONS, type PersonId } from '../core/types';
import type { Coverage, ParentStatus } from '../core/calendar';

export const STATUS_ICON: Record<ParentStatus, string> = {
  free: '·',
  office: '🏢',
  homeoffice: '🏠',
  vacation: '🌴',
  trip: '✈️',
};
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
  options: { value: T; label: string; color?: string }[];
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

export function Sheet(props: { title: string; onClose: () => void; children: ComponentChildren }) {
  return (
    <div class="backdrop" onClick={props.onClose}>
      <div class="sheet" onClick={(e) => e.stopPropagation()}>
        <div class="sheet-head">
          <h2>{props.title}</h2>
          <button class="icon-btn" onClick={props.onClose} aria-label="Schließen">
            ✕
          </button>
        </div>
        <div class="sheet-body">{props.children}</div>
      </div>
    </div>
  );
}
