/**
 * Minimaler ICS-Parser (RFC 5545) für VEVENTs – z. B. Schul-/Kita-Kalender als .ics.
 * Übernimmt: Zeilenfaltung, DTSTART/DTEND (DATE und DATE-TIME, Zeitzone wird als lokale Uhrzeit interpretiert),
 * SUMMARY, DESCRIPTION. Unbekannte Eigenschaften werden ignoriert.
 */
import { addDays } from './dates';

export interface IcsEvent {
  title: string;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD, inklusive
  time?: string; // HH:MM
  endTime?: string; // HH:MM
  note?: string;
}

const unescape = (s: string) => s.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
const d8 = (s: string) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
const hm = (t: string) => `${t.slice(0, 2)}:${t.slice(2, 4)}`;

export function parseIcs(text: string): IcsEvent[] {
  // Zeilenfaltung auflösen: Fortsetzungszeilen beginnen mit Leerzeichen/TAB
  const lines: string[] = [];
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    if ((raw.startsWith(' ') || raw.startsWith('\t')) && lines.length) lines[lines.length - 1] += raw.slice(1);
    else lines.push(raw);
  }

  const out: IcsEvent[] = [];
  let cur: Record<string, string> | null = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') cur = {};
    else if (line === 'END:VEVENT') {
      if (cur) {
        const m = (cur.DTSTART ?? '').match(/^(\d{8})(?:T(\d{6}))?/);
        if (m) {
          const m2 = (cur.DTEND ?? '').match(/^(\d{8})(?:T(\d{6}))?/);
          // RFC 5545: bei Allday-Events (VALUE=DATE) ist DTEND exklusiv -> einen Tag zurück
          const allDay = (cur.DTSTART_PARAMS ?? '').includes('VALUE=DATE');
          out.push({
            title: unescape(cur.SUMMARY ?? '(ohne Titel)'),
            start: d8(m[1]),
            end: m2 ? (allDay && m2[1] > m[1] ? addDays(d8(m2[1]), -1) : d8(m2[1])) : d8(m[1]),
            time: m[2] ? hm(m[2]) : undefined,
            endTime: m2?.[2] ? hm(m2[2]) : undefined,
            note: cur.DESCRIPTION ? unescape(cur.DESCRIPTION) : undefined,
          });
        }
      }
      cur = null;
    } else if (cur) {
      const i = line.indexOf(':');
      if (i > 0) {
        const [key, ...params] = line.slice(0, i).split(';');
        cur[key.toUpperCase()] = line.slice(i + 1);
        if (params.length) cur[key.toUpperCase() + '_PARAMS'] = params.join(';').toUpperCase();
      }
    }
  }
  return out;
}
