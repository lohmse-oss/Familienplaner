import type { Item } from '../core/types';
import { Ic } from './icons';

const mapsUrl = (q: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
const httpUrl = (u: string) => (/^https?:\/\//i.test(u) ? u : `https://${u}`);
const telOf = (c: string) => c.match(/\+?[\d][\d\s()/-]{5,}/)?.[0]?.replace(/[^\d+]/g, '');

/** Ergänzende Infos zu einem Eintrag: Zeit bis, Ort (öffnet Karten), Kontakt (wählt), Link, Notiz. */
export function Details({ it }: { it: Item }) {
  const tel = it.contact ? telOf(it.contact) : undefined;
  if (!it.endTime && !it.place && !it.contact && !it.link && !it.note) return null;
  return (
    <div class="details" onClick={(e) => e.stopPropagation()}>
      {it.endTime && <span><Ic n="clock" size={13} /> bis {it.endTime} Uhr</span>}
      {it.place && <a href={mapsUrl(it.place)} target="_blank" rel="noopener"><Ic n="pin" size={13} /> {it.place}</a>}
      {it.contact && (tel ? <a href={`tel:${tel}`}><Ic n="phone" size={13} /> {it.contact}</a> : <span><Ic n="user" size={13} /> {it.contact}</span>)}
      {it.link && <a href={httpUrl(it.link)} target="_blank" rel="noopener"><Ic n="link" size={13} /> {it.link.replace(/^https?:\/\//i, '').slice(0, 32)}</a>}
      {it.note && <span class="det-note"><Ic n="note" size={13} /> {it.note}</span>}
    </div>
  );
}
