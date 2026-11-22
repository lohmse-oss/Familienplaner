import { useUiState } from '../resume';
import { ALL, CHILDREN, EVERY_LABEL, LEAD_LABEL, MODE_LABEL, PARENTS, PERSONS, RECUR_LABEL, SUB_LABEL, type EventSub, type Every, type Item, type Lead, type Kind, type Mode, type PersonId, type Recur } from '../core/types';
import { deleteItem, newId, saveItem, useStore, withUndo } from '../store';
import { describeChange } from '../core/describe';
import { Overlap } from './Overlap';
import { diff, fmt, fmtShort, today } from '../core/dates';
import { addMonths, nextDue, remindFrom } from '../core/recur';
import { Chips, DateInput, Sheet } from './common';
import { RangePicker } from './RangePicker';
import { Ic, type IconName } from './icons';

export const KINDS: { kind: Exclude<Kind, 'config' | 'shop' | 'list' | 'check' | 'fact' | 'meal'>; short: string; label: string; icon: IconName; hint: string }[] = [
  { kind: 'presence', short: 'Eintrag', label: 'Urlaub / Dienstreise / Homeoffice', icon: 'palm', hint: 'Wer ist anwesend?' },
  { kind: 'care', short: 'Betreuungsbedarf', label: 'Betreuungsbedarf', icon: 'baby', hint: 'Schließtag Kita/Schule, krank …' },
  { kind: 'event', short: 'Termin', label: 'Termin', icon: 'addcal', hint: 'Arzt, Klassenarbeit, Elternabend' },
  { kind: 'task', short: 'Aufgabe', label: 'Aufgabe', icon: 'tasks', hint: 'mit Fälligkeit' },
  { kind: 'cover', short: 'Betreuung', label: 'Betreuung durch Dritte', icon: 'hand', hint: 'Oma, Freunde …' },
  { kind: 'info', short: 'Event', label: 'Event', icon: 'ticket', hint: 'Festival, Konzert, Veranstaltung – zuhause oder auswärts' },
  { kind: 'birthday', short: 'Geburtstag', label: 'Geburtstag', icon: 'cake', hint: 'jährlich' },
];

/** Typische Fristen: setzen Titel und Vorlauf (TÜV zusätzlich alle 2 Jahre). Person/Name ergänzt man im Titel. */
const DEADLINE_PRESETS: { title: string; lead: Lead; every?: Every; icon: IconName }[] = [
  { title: 'Personalausweis', lead: '3m', icon: 'user' },
  { title: 'Reisepass', lead: '3m', icon: 'plane' },
  { title: 'Führerschein', lead: '3m', icon: 'user' },
  { title: 'TÜV / HU', lead: '1m', every: '2years', icon: 'repeat' },
  { title: 'Vertrag kündigen bis', lead: '1m', icon: 'note' },
  { title: 'Garantie endet', lead: '1m', icon: 'clock' },
];

const personOpts = (list: PersonId[]) => list.map((p) => ({ value: p, label: PERSONS[p].name, color: PERSONS[p].color }));
const CARE_PRESETS: { label: string; child?: PersonId }[] = [
  { label: 'Schließtag Kita', child: 'irma' },
  { label: 'Schließtag Schule', child: 'ida' },
  { label: 'Krank' },
  { label: 'Sonstiges' },
];

export function KindPicker({ onPick, onClose, onShop }: { onPick: (k: Kind) => void; onClose: () => void; onShop: () => void }) {
  return (
    <Sheet title="Neuer Eintrag" onClose={onClose}>
      <div class="kinds">
        <button class="kind" onClick={onShop}>
          <span class="ic"><Ic n="cart" size={24} /></span>
          <span><b>Artikel zur Einkaufsliste</b><small>direkt eintippen</small></span>
        </button>
        {KINDS.filter((k) => k.kind !== 'cover' && k.kind !== 'birthday').map((k) => ( // Betreuung durch Dritte: im Betreuungsbedarf bzw. Jahresplaner; Geburtstag nur unter Mehr
          <button key={k.kind} class="kind" onClick={() => onPick(k.kind)}>
            <span class="ic"><Ic n={k.icon} size={24} /></span>
            <span><b>{k.label}</b><small>{k.hint}</small></span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

export function EditSheet({ initial, onClose }: { initial: Partial<Item> & { kind: Kind }; onClose: () => void }) {
  const { settings, readOnly } = useStore();
  const isNew = !initial.id;
  const k = initial.kind;
  // Entwurf wird laufend gesichert: Wechselt man kurz in eine andere App und Android startet den Planer neu, ist die Eingabe noch da.
  const [d, setD] = useUiState<Item>('edit', () => ({
    id: initial.id ?? newId(),
    updated: 0,
    start: initial.start ?? '',
    end: initial.end ?? initial.start ?? '',
    persons: initial.persons ?? (k === 'presence' ? [settings.me] : []),
    mode: k === 'presence' ? (initial.mode ?? 'vacation') : initial.mode,
    owner: initial.owner ?? null,
    sub: k === 'event' ? (initial.sub ?? 'arzt') : initial.sub,
    ...initial,
    kind: k,
  }), { clearOnUnmount: true, accept: (x) => x.kind === k && (initial.id ? x.id === initial.id : !x.created) });
  const set = (patch: Partial<Item>) => setD((x) => ({ ...x, ...patch }));
  const [coverBy, setCoverBy] = useUiState('edit.coverBy', '', { clearOnUnmount: true });

  // Übernahme-Anfrage an den Partner (nur Eltern)
  const me = settings.me;
  const partner = PARENTS.find((p) => p !== me);
  const a = d.ask;
  const pending = a && a.at !== initial.ask?.at; // noch nicht gespeichert
  const askBox = PARENTS.includes(me) && partner && !readOnly ? (
    <div class="ask-box">
      {a?.state === 'open' && a.to === me ? (
        <>
          <span class="grow"><b>{PERSONS[a.from].name}</b> fragt, ob du übernimmst.</span>
          <button type="button" class="btn small" onClick={() => set({ ask: { ...a, state: 'declined', at: Date.now() } })}>Ablehnen</button>
          <button type="button" class="btn small primary" onClick={() => set({ owner: me, ask: { ...a, state: 'accepted', at: Date.now() } })}>Zusagen</button>
        </>
      ) : a?.state === 'open' && a.from === me ? (
        <>
          <span class="grow"><Ic n="send" size={14} /> Anfrage an {PERSONS[a.to].name} {pending ? 'wird mit „Speichern“ gesendet' : 'läuft'}</span>
          <button type="button" class="link" onClick={() => set({ ask: pending ? initial.ask : undefined })}>{pending ? 'doch nicht' : 'zurückziehen'}</button>
        </>
      ) : (
        <>
          {a && a.state !== 'open' && <span class="grow muted small">{PERSONS[a.to].name} hat {a.state === 'accepted' ? 'zugesagt' : 'abgelehnt'}{pending ? ' (wird mit „Speichern“ gesendet)' : ''}.</span>}
          {d.owner !== partner && !pending && (
            <button type="button" class="btn small" onClick={() => set({ ask: { from: me, to: partner, state: 'open', at: Date.now() } })}><Ic n="send" size={14} /> {PERSONS[partner].name} um Übernahme bitten</button>
          )}
        </>
      )}
    </div>
  ) : null;
  // Termine: eintägig, mehrtägig (Festival, Ausflug) oder wiederkehrend (dann ist end das Serienende)
  const multi = (k === 'event' || k === 'info') && !d.recur && d.end > d.start;
  const single = (k === 'event' && !multi) || k === 'task' || k === 'birthday';
  const pickOne = k === 'task' || (k === 'event' && !!d.recur); // nur ein Datum (Fälligkeit bzw. erstes Vorkommen)
  const info = KINDS.find((x) => x.kind === k)!;
  const what = k === 'presence' && d.mode ? MODE_LABEL[d.mode] : info.short;

  const valid = (() => {
    if (!d.start) return false; // Neuanlage: erst gültiges Datum, dann speicherbar
    if (['event', 'task', 'birthday', 'info'].includes(k) && !d.title?.trim()) return false;
    if (k === 'care' && !d.persons.some((p) => CHILDREN.includes(p))) return false;
    if (k === 'presence' && (!d.persons.length || !d.mode)) return false;
    return d.end >= d.start;
  })();

  const save = (forceDone?: boolean) => {
    const clean = (v?: string) => v?.trim() || undefined;
    const out: Item = { ...d, done: forceDone ?? d.done, title: clean(d.title), place: clean(d.place), contact: clean(d.contact), link: clean(d.link), end: single ? d.start : d.end };
    if (k !== 'event' && k !== 'info') delete out.endTime;
    if (k !== 'event' && k !== 'info') {
      delete out.place;
      delete out.contact;
      delete out.link;
    }
    if (k !== 'presence') delete out.mode;
    if (!(k === 'presence' && d.mode === 'vacation') && k !== 'info') delete out.away;
    if (k === 'info' && !out.away) delete out.away;
    if (k !== 'event' || !out.recur) delete out.recur;
    if (k !== 'task' || !out.every) delete out.every;
    if (k !== 'task' || !out.lead) delete out.lead;
    if ((k !== 'event' && k !== 'task') || !out.ask) delete out.ask;
    // Wiederkehrende Aufgabe als erledigt markiert → nächste Fälligkeit
    let label = `${what} ${isNew ? 'gespeichert' : 'geändert'}`;
    if (k === 'task' && out.every && out.done && !initial.done) {
      out.start = out.end = nextDue(out.start, out.every);
      out.done = false;
      label = `Erledigt – nächste Fälligkeit ${fmtShort(out.start)}`;
    }
    // Betreuungsbedarf mit „Wer betreut?“ → zusätzlich Betreuung durch Dritte für denselben Zeitraum
    const cover: Item | null =
      k === 'care' && isNew && coverBy.trim() ? { id: newId(), kind: 'cover', updated: 0, title: coverBy.trim(), persons: out.persons.filter((p) => CHILDREN.includes(p)), start: out.start, end: out.end } : null;
    // Bestätigung: was genau gespeichert wurde, mit „Rückgängig“
    withUndo(label, () => { saveItem(out); if (cover) saveItem(cover); }, `${describeChange({ ...out, updated: 0 })?.text}${cover ? ` · Betreuung durch ${cover.title}` : ''}`);
    onClose();
  };
  const remove = () => {
    withUndo(`${what} gelöscht`, () => deleteItem(d.id), describeChange({ ...d, updated: 0 })?.text);
    onClose();
  };

  return (
    <Sheet
      title={`${isNew ? '' : 'Bearbeiten: '}${info.label}`} onClose={onClose}
      footer={
        <div class="actions">
          {!isNew && <button class="btn danger" onClick={remove}>Löschen</button>}
          <span class="grow" />
          <button class="btn" onClick={onClose}>Abbrechen</button>
          <button class="btn primary" disabled={!valid} onClick={() => save()}>Speichern</button>
        </div>
      }
    >
      <div class="form">
        {k === 'presence' && (
          <>
            <label>Art</label>
            <Chips<Mode> options={(['vacation', 'trip', 'homeoffice'] as Mode[]).map((m) => ({ value: m, label: MODE_LABEL[m] }))} value={d.mode ? [d.mode] : []} onChange={(v) => set({ mode: v[0] })} />
            <label>Wer?</label>
            <Chips<PersonId> options={personOpts(ALL)} value={d.persons} onChange={(persons) => set({ persons })} multi />
            {d.persons.some((p) => CHILDREN.includes(p)) && <p class="hint">Kinder mit im Urlaub → sie brauchen in dieser Zeit keine Betreuung.</p>}
            {d.mode === 'vacation' && (
              <label class="check"><input type="checkbox" checked={!!d.away} onChange={(e) => set({ away: (e.target as HTMLInputElement).checked })} /> verreist (nicht vor Ort, kann keine Betreuung übernehmen)</label>
            )}
          </>
        )}

        {k === 'care' && (
          <>
            <label>Was?</label>
            <Chips<string>
              options={CARE_PRESETS.map((p) => ({ value: p.label, label: p.label }))}
              value={d.title ? [d.title] : []}
              onChange={(v) => {
                const p = CARE_PRESETS.find((x) => x.label === v[0]);
                set({ title: v[0], persons: p?.child ? [p.child] : d.persons });
              }}
            />
            <label>Welches Kind?</label>
            <Chips<PersonId> options={personOpts(CHILDREN)} value={d.persons} onChange={(persons) => set({ persons })} multi />
            {isNew && (
              <>
                <label>Wer betreut? (optional)</label>
                <input type="text" placeholder="z. B. Oma, Nachbarin – leer = noch offen" value={coverBy} onInput={(e) => setCoverBy((e.target as HTMLInputElement).value)} />
                <p class="hint">{coverBy.trim() ? `Legt zusätzlich „Betreuung durch ${coverBy.trim()}“ für denselben Zeitraum an – die Ampel wird grün.` : 'Bleibt leer, zeigt die Ampel, ob ihr Eltern das selbst abdeckt.'}</p>
              </>
            )}
          </>
        )}

        {k === 'cover' && (
          <>
            <label>Wer übernimmt?</label>
            <input type="text" placeholder="z. B. Oma, Nachbarin" value={d.title ?? ''} onInput={(e) => set({ title: (e.target as HTMLInputElement).value })} />
            <label>Für welches Kind? (leer = alle)</label>
            <Chips<PersonId> options={personOpts(CHILDREN)} value={d.persons} onChange={(persons) => set({ persons })} multi />
          </>
        )}

        {k === 'event' && (
          <>
            <label>Art</label>
            <Chips<EventSub> options={(Object.keys(SUB_LABEL) as EventSub[]).map((s) => ({ value: s, label: SUB_LABEL[s] }))} value={d.sub ? [d.sub] : []} onChange={(v) => set({ sub: v[0] })} />
            <label>Titel</label>
            <input type="text" placeholder="z. B. Kinderarzt U8" value={d.title ?? ''} onInput={(e) => set({ title: (e.target as HTMLInputElement).value })} />
            <label>Betrifft</label>
            <Chips<PersonId> options={personOpts(ALL)} value={d.persons} onChange={(persons) => set({ persons })} multi />
            {d.sub !== 'schule' && (
              <>
                <label>Wer kümmert sich?</label>
                <Chips<string> options={[...personOpts(PARENTS), { value: '', label: 'noch offen' }]} value={[d.owner ?? '']} onChange={(v) => set({ owner: (v[0] || null) as PersonId | null })} />
                {askBox}
              </>
            )}
            <label>Wiederholung</label>
            <Chips<string>
              options={[{ value: '', label: 'keine' }, ...(Object.keys(RECUR_LABEL) as Recur[]).map((r) => ({ value: r, label: RECUR_LABEL[r] }))]}
              value={[d.recur ?? '']}
              onChange={(v) => set({ recur: (v[0] || undefined) as Recur | undefined, end: d.start })}
            />
            {d.recur && d.end <= d.start && <p class="hint">Ohne Enddatum wiederholt sich der Termin bis zum Anzeigelimit (400 Tage ab erstem Vorkommen).</p>}
          </>
        )}

        {k === 'task' && (
          <>
            {isNew && (
              <div class="chips scroll presets">
                {DEADLINE_PRESETS.map((p) => (
                  <button key={p.title} type="button" class={`chip ${d.title?.startsWith(p.title) ? 'on' : ''}`} onClick={() => set({ title: p.title + ' ', lead: p.lead, every: p.every })}>
                    <Ic n={p.icon} size={13} /> {p.title}
                  </button>
                ))}
              </div>
            )}
            <label>Aufgabe</label>
            <input type="text" placeholder="z. B. Geschenk besorgen" value={d.title ?? ''} onInput={(e) => set({ title: (e.target as HTMLInputElement).value })} />
            <label>Zuständig</label>
            <Chips<string> options={[...personOpts(PARENTS), { value: '', label: 'offen' }]} value={[d.owner ?? '']} onChange={(v) => set({ owner: (v[0] || null) as PersonId | null })} />
            {askBox}
            <label>Wiederholung</label>
            <Chips<string>
              options={[{ value: '', label: 'keine' }, ...(Object.keys(EVERY_LABEL) as Every[]).map((e) => ({ value: e, label: EVERY_LABEL[e] }))]}
              value={[d.every ?? '']}
              onChange={(v) => set({ every: (v[0] || undefined) as Every | undefined })}
            />
            <label>Frist mit Vorlauf (z. B. Ablaufdatum)</label>
            <Chips<string>
              options={[{ value: '', label: 'keine' }, ...(Object.keys(LEAD_LABEL) as Lead[]).map((l) => ({ value: l, label: `${LEAD_LABEL[l]} vorher` }))]}
              value={[d.lead ?? '']}
              onChange={(v) => set({ lead: (v[0] || undefined) as Lead | undefined })}
            />
            {d.lead && (
              <p class="hint">
                Unten das Ablauf- bzw. Stichdatum eintragen.{' '}
                {remindFrom(d.start, d.lead) > today()
                  ? `Bis ${fmt(remindFrom(d.start, d.lead))} steht die Aufgabe nur unter „Vorgemerkt“ und zählt nicht als offen – ab dann erinnert die App (Startseite, Aufgaben, Benachrichtigung).`
                  : 'Bis dahin steht die Aufgabe nur unter „Vorgemerkt“; ab Beginn des Vorlaufs erinnert die App (Startseite, Aufgaben, Benachrichtigung).'}
              </p>
            )}
            {!isNew && d.lead && !d.every && (
              <div class="renew">
                <span class="muted small">Erneuert? Neues Ablaufdatum ab heute:</span>
                {[1, 2, 5, 6, 10].map((y) => (
                  <button key={y} type="button" class="chip" onClick={() => { const v = addMonths(today(), 12 * y); set({ start: v, end: v, done: false }); }}>+{y} J.</button>
                ))}
              </div>
            )}
            <div class="actions wrap">
              <button type="button" class={`btn ${d.done ? '' : 'primary'}`} onClick={() => save(!d.done)}>
                <Ic n={d.done ? 'reset' : 'check'} size={15} /> {d.done ? 'Wieder offen' : 'Als erledigt markieren'}{d.every && !initial.done && !d.done ? ' – rückt auf die nächste Fälligkeit' : ''}
              </button>
            </div>
          </>
        )}

        {k === 'info' && (
          <>
            <label>Titel</label>
            <input type="text" placeholder="z. B. Stadtfest, Festival, Konzert" value={d.title ?? ''} onInput={(e) => set({ title: (e.target as HTMLInputElement).value })} />
            <label>Wo?</label>
            <Chips<string>
              options={[
                { value: 'home', label: <><Ic n="home" size={15} /> zuhause / vor Ort</> },
                { value: 'away', label: <><Ic n="luggage" size={15} /> auswärts</> },
              ]}
              value={[d.away ? 'away' : 'home']}
              onChange={(v) => set({ away: v[0] === 'away' })}
            />
            <label>Wen betrifft es? (leer = Familie)</label>
            <Chips<PersonId> options={personOpts(ALL)} value={d.persons} onChange={(persons) => set({ persons })} multi />
          </>
        )}

        {k === 'birthday' && (
          <>
            <label>Wer hat Geburtstag?</label>
            <input type="text" placeholder="z. B. Oma Helga" value={d.title ?? ''} onInput={(e) => set({ title: (e.target as HTMLInputElement).value })} />
            <p class="hint">Geburtsdatum inkl. Jahr eintragen (auch als Text, z. B. 7.5.1955) – das Jahr wird nur für die Altersanzeige verwendet; im Kalender zählt weiterhin nur Tag/Monat.</p>
          </>
        )}

        {k === 'presence' && (
          <>
            <label>Ziel / Notiz (optional)</label>
            <input type="text" placeholder="z. B. Ostsee, Messe Köln" value={d.title ?? ''} onInput={(e) => set({ title: (e.target as HTMLInputElement).value })} />
          </>
        )}

        {k === 'birthday' ? (
          <>
            <label>Geburtsdatum</label>
            <DateInput value={d.start} onChange={(v) => set({ start: v, end: v })} />
          </>
        ) : (
          <>
            {/* Ein Kalender statt Von/Bis: 1. Tippen = Start, 2. Tippen = Ende; ein Tag = zweimal denselben Tag */}
            <label>{pickOne ? (k === 'task' ? (d.lead ? 'Läuft ab / Stichtag' : 'Fällig am') : 'Erster Termin') : 'Wann? Start und Ende antippen – ein Tag: zweimal tippen'}</label>
            <RangePicker start={d.start} end={pickOne ? d.start : d.end} single={pickOne} onChange={(s, e) => set({ start: s, end: e })} />
            {diff(d.start, d.end) > 400 && <p class="hint neg">Zeitraum länger als 400 Tage – ab Tag 401 wird der Eintrag nicht mehr angezeigt.</p>}
          </>
        )}

        {(k === 'event' || k === 'info') && <div class="row">
          {(
            <div>
              <label>{multi ? 'Beginn (Uhr)' : 'Uhrzeit'}</label>
              <input type="time" value={d.time ?? ''} onInput={(e) => set({ time: (e.target as HTMLInputElement).value || undefined })} />
            </div>
          )}
          {(
            <div>
              <label>{multi ? 'Ende am letzten Tag (Uhr)' : 'Bis (Uhr, optional)'}</label>
              <input type="time" value={d.endTime ?? ''} onInput={(e) => set({ endTime: (e.target as HTMLInputElement).value || undefined })} />
            </div>
          )}
        </div>}

        {k !== 'birthday' && <Overlap start={d.start} end={single ? d.start : d.end} excludeId={d.id} />}

        {(k === 'event' || k === 'info') && (
          <>
            <label>Ort (optional)</label>
            <input type="text" placeholder="z. B. Praxis Dr. Müller, Markt 3" value={d.place ?? ''} onInput={(e) => set({ place: (e.target as HTMLInputElement).value })} />
            <label>Kontakt / Telefon (optional)</label>
            <input type="text" placeholder="z. B. Frau Meier 0371 123456" value={d.contact ?? ''} onInput={(e) => set({ contact: (e.target as HTMLInputElement).value })} />
            <label>Link (optional)</label>
            <input type="text" inputMode="url" placeholder="https://…" value={d.link ?? ''} onInput={(e) => set({ link: (e.target as HTMLInputElement).value })} />
          </>
        )}

        {k !== 'birthday' && (
          <>
            <label>Notiz / ergänzende Infos (optional)</label>
            <textarea rows={2} value={d.note ?? ''} onInput={(e) => set({ note: (e.target as HTMLTextAreaElement).value || undefined })} />
          </>
        )}
      </div>

      {!isNew && d.by && <p class="hint">Zuletzt geändert von {PERSONS[d.by].name}</p>}
    </Sheet>
  );
}
