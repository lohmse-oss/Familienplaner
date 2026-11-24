import { useEffect, useState } from 'preact/hooks';
import { useUiState } from '../resume';
import { addDays, fmtDay, fmtShort, range, today } from '../core/dates';
import { doneMeals, mealOn, nextFreeMealDay, poolMeals } from '../core/meals';
import { PERSONS, type Item } from '../core/types';
import { haptic } from '../haptics';
import { addMeal, addMealToPool, batch, confirmMeal, deleteMeal, saveItem, setMealDate, swapMealEntries, sync, unconfirmMeal, useStore } from '../store';
import { DateInput, Sheet } from './common';
import { Ic } from './icons';

/**
 * Mahlzeiten: fortlaufende Liste je Tag. Nicht bestätigte Mahlzeiten vergangener Tage wandern
 * automatisch in den Pool (zeitlich absteigend – neueste zuerst). Tauschen per Antippen: Mahlzeit → „Tauschen mit …“
 * → Ziel antippen (Tageszeile in der Übersicht, Pool oder Erledigt) – Tag ↔ Tag und Tag ↔ Pool.
 */
export function Meals() {
  const { items, settings, readOnly } = useStore();
  const t0 = today();
  const [date, setDate] = useUiState('meal.date', t0);
  const [text, setText] = useUiState('meal.text', '');
  const [poolText, setPoolText] = useUiState('meal.pooltext', '');
  const [swapId, setSwapId] = useState<string | null>(null);
  const [edit, setEdit] = useState<Item | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [showOv, setShowOv] = useState(true);
  const [daysN, setDaysN] = useState(7); // Übersicht: heute + 6 Tage, manuell erweiterbar

  const pool = poolMeals(items);
  const done = doneMeals(items).filter((m) => m.start >= addDays(t0, -7)); // letzte Woche
  const ovDays = [...range(t0, addDays(t0, daysN - 1))];
  const allBooked = ovDays.every((d) => !!mealOn(items, d)); // „+1 Tag“ nur anzeigen, wenn alle Tage belegt

  // Solange die Liste offen ist, schneller abgleichen (beide planen parallel)
  useEffect(() => {
    const id = setInterval(() => document.visibilityState === 'visible' && void sync(), 12_000);
    return () => clearInterval(id);
  }, []);

  const submit = (e: Event) => {
    e.preventDefault();
    if (!text.trim()) return;
    addMeal(date, text);
    haptic();
    setText('');
  };
  const submitPoolInline = (e: Event) => {
    e.preventDefault();
    if (!poolText.trim()) return;
    addMealToPool(poolText);
    haptic();
    setPoolText('');
  };

  const pickSwap = (target: Item) => {
    if (!swapId || swapId === target.id) return setSwapId(null);
    haptic();
    swapMealEntries(swapId, target.id);
    setSwapId(null);
  };

  const Row = ({ m, inPool = false }: { m: Item; inPool?: boolean }) => (
    <div
      class={`shop-row meal-row ${m.done ? 'done' : ''} ${swapId === m.id ? 'on' : ''} ${swapId && swapId !== m.id ? 'target' : ''} ${!inPool && m.start === t0 ? 'today' : ''}`}
      onClick={() => (swapId ? pickSwap(m) : setEdit(m))}
    >
      {!inPool && m.start <= t0 && (
        <button
          class="check-btn"
          disabled={readOnly}
          onClick={(e) => {
            e.stopPropagation();
            haptic(m.done ? 'light' : 'success');
            if (m.done) unconfirmMeal(m.id);
            else confirmMeal(m.id);
          }}
          aria-label={m.done ? 'wieder offen' : 'als gegessen bestätigen'}
        >
          {m.done && <Ic n="check" size={16} sw={3} />}
        </button>
      )}
      <span class="meal-date">{inPool ? '' : m.start ? fmtDay(m.start) : '–'}</span>
      <span class="grow">{m.title}</span>
      {m.by && m.by !== settings.me && <i class="dot" style={{ background: PERSONS[m.by].color }} title={`von ${PERSONS[m.by].name}`} />}
      {!readOnly && (
        <>
          {inPool && <button class="x-btn" onClick={(e) => { e.stopPropagation(); haptic(); setMealDate(m.id, t0); }} aria-label="auf heute legen" title="Auf heute legen"><Ic n="today" size={16} /></button>}
          <button class={`x-btn ${swapId === m.id ? 'on' : ''}`} onClick={(e) => { e.stopPropagation(); setSwapId(swapId === m.id ? null : m.id); }} aria-label="tauschen" title="Tauschen mit …"><Ic n="swap" size={16} /></button>
          <button class="x-btn" onClick={(e) => { e.stopPropagation(); deleteMeal(m.id); }} aria-label="löschen"><Ic n="x" size={16} /></button>
        </>
      )}
    </div>
  );

  return (
    <div class="page">
      <button class="link done-toggle" onClick={() => setShowOv(!showOv)}>
        <Ic n={showOv ? 'down' : 'right'} size={15} /> Übersicht (heute + {daysN - 1} Tage, bis {fmtShort(addDays(t0, daysN - 1))})
      </button>
      {showOv && (
        <section class="card shop-list">
          {ovDays.map((d) => {
            const m = mealOn(items, d);
            return (
              <div
                key={d}
                class={`shop-row meal-row ${m?.done ? 'done' : ''} ${d === t0 ? 'today' : ''} ${swapId === m?.id ? 'on' : ''} ${swapId && m && swapId !== m.id ? 'target' : ''}`}
                onClick={() => {
                  if (swapId) {
                    if (m) pickSwap(m);
                    return;
                  }
                  if (m) setEdit(m);
                  else if (!readOnly) setDate(d);
                }}
              >
                {m && !m.done && m.start <= t0 && !readOnly && (
                  <button class="check-btn" onClick={(e) => { e.stopPropagation(); haptic('success'); confirmMeal(m.id); }} aria-label="als gegessen bestätigen" />
                )}
                <span class="meal-date">{fmtDay(d)}</span>
                <span class="grow">{m ? m.title : <span class="muted">nicht geplant</span>}</span>
                {m?.done && <Ic n="check" size={16} class="muted" />}
                {!m && !readOnly && <Ic n="plus" size={15} class="muted" />}
              </div>
            );
          })}
          <div class="actions wrap">
            {allBooked && daysN < 60 && <button class="btn small" onClick={() => setDaysN(daysN + 1)}>+1 Tag</button>}
          </div>
        </section>
      )}

      {!readOnly && (
        <>
          <form class="shop-add meal-add" onSubmit={submit}>
            <DateInput value={date} onChange={setDate} ariaLabel="Tag" picker={false} />
            <input type="text" placeholder="Mahlzeit …" value={text} onInput={(e) => setText((e.target as HTMLInputElement).value)} enterkeyhint="done" autocomplete="off" />
            <button class="btn primary" type="submit" disabled={!text.trim()} aria-label="auf den Tag legen" title="Auf den gewählten Tag legen"><Ic n="plus" size={22} /></button>
          </form>
          <div class="chips" style={{ marginBottom: 10 }}>
            {[0, 1, 2].map((n) => {
              const d = addDays(t0, n);
              return (
                <button key={d} class={`chip ${d === date ? 'on' : ''}`} onClick={() => { haptic(); setDate(d); }}>
                  {n === 0 ? 'Heute' : n === 1 ? 'Morgen' : fmtDay(d)}
                </button>
              );
            })}
          </div>
        </>
      )}

      {swapId && (
        <div class="quick">
          <Ic n="swap" size={16} /> Tauschen: andere Mahlzeit antippen (Tag oder Pool). <button class="link" onClick={() => setSwapId(null)}>Abbrechen</button>
        </div>
      )}

      <h3 class="section">Pool ({pool.length})</h3>
      {!readOnly && (
        <form class="shop-add meal-add" onSubmit={submitPoolInline}>
          <input type="text" placeholder="Direkt in den Pool …" value={poolText} onInput={(e) => setPoolText((e.target as HTMLInputElement).value)} enterkeyhint="done" autocomplete="off" aria-label="Mahlzeit direkt in den Pool" />
          <button class="btn primary" type="submit" disabled={!poolText.trim()} aria-label="in den Pool" title="In den Pool"><Ic n="pool" size={20} /></button>
        </form>
      )}
      <section class="card shop-list">
        {pool.length === 0 && <div class="empty">Der Pool ist leer.<br /><span class="muted">Nicht bestätigte Mahlzeiten wandern nach dem Tag automatisch hierher – neueste zuerst – hier direkt per Text + Enter eintragen.</span></div>}
        {pool.map((m) => <Row key={m.id} m={m} inPool />)}
      </section>

      {done.length > 0 && (
        <>
          <button class="link done-toggle" onClick={() => setShowDone(!showDone)}><Ic n={showDone ? 'down' : 'right'} size={15} /> Erledigt ({done.length})</button>
          {showDone && (
            <section class="card shop-list">
              {done.map((m) => <Row key={m.id} m={m} />)}
            </section>
          )}
        </>
      )}

      {edit && <MealSheet key={edit.id} item={edit} onClose={() => setEdit(null)} onSwap={() => setSwapId(edit.id)} />}
    </div>
  );
}

/** Bearbeiten einer Mahlzeit: Titel/Tag ändern, tauschen oder löschen. */
function MealSheet({ item, onClose, onSwap }: { item: Item; onClose: () => void; onSwap: () => void }) {
  const { readOnly, items } = useStore();
  const t0 = today();
  const [title, setTitle] = useState(item.title ?? '');
  const [date, setDate] = useState(item.pool ? nextFreeMealDay(items, t0) : item.start); // Pool-Eintrag landet default auf dem nächsten freien Tag (nicht heute)
  const changed = title.trim() !== (item.title ?? '') || date !== item.start;
  const save = () => {
    batch(() => {
      if (title.trim() && title.trim() !== item.title) saveItem({ ...item, title: title.trim() });
      if (date !== item.start || item.pool) setMealDate(item.id, date);
    });
    haptic('success');
    onClose();
  };
  return (
    <Sheet
      title={item.pool ? 'Mahlzeit aus dem Pool' : 'Mahlzeit'}
      onClose={onClose}
      footer={!readOnly && <button class="btn primary" style={{ width: '100%' }} disabled={!title.trim() || (!changed && !item.pool)} onClick={save}>{item.pool ? 'Auf diesen Tag legen' : 'Speichern'}</button>}
    >
      <div class="form">
        <label>Mahlzeit</label>
        <input type="text" value={title} onInput={(e) => setTitle((e.target as HTMLInputElement).value)} placeholder="z. B. Nudeln mit Tomatensoße" disabled={readOnly} />
        <label>Tag</label>
        <DateInput value={date} onChange={setDate} ariaLabel="Tag" />
        {!readOnly && !item.done && (
          <div class="actions wrap">
            <button class="btn small" onClick={() => { onSwap(); onClose(); }}><Ic n="swap" size={14} /> Tauschen mit …</button>
            <button class="btn small danger" onClick={() => { deleteMeal(item.id); onClose(); }}><Ic n="trash" size={14} /> Löschen</button>
          </div>
        )}
      </div>
    </Sheet>
  );
}
