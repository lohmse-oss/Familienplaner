export type PersonId = 'sebastian' | 'betty' | 'ida' | 'irma';

export const PERSONS: Record<PersonId, { name: string; adult: boolean; color: string; soft: string }> = {
  sebastian: { name: 'Sebastian', adult: true, color: '#1b4965', soft: '#d6e6f0' }, // Marine/Petrol
  betty: { name: 'Betty', adult: true, color: '#c2336b', soft: '#f8d9e6' }, // Beere/Rosé
  ida: { name: 'Ida', adult: false, color: '#8e6bc4', soft: '#e7dcf6' }, // Flieder
  irma: { name: 'Irma', adult: false, color: '#f0764a', soft: '#fde0d3' }, // Koralle
};

export const PARENTS: PersonId[] = ['sebastian', 'betty'];
export const CHILDREN: PersonId[] = ['ida', 'irma'];
export const ALL: PersonId[] = ['sebastian', 'betty', 'ida', 'irma'];

/**
 * Terminarten:
 *  presence – Anwesenheit der Eltern (Urlaub, Dienstreise, Homeoffice); Kinder dürfen mit (Familienurlaub)
 *  care     – Betreuungsbedarf der Kinder (Schließtag Kita/Schule, krank, ...)
 *  cover    – Betreuung durch Dritte (Oma, Freunde) deckt Betreuungsbedarf
 *  event    – Einmaltermin (Arzt, Klassenarbeit, Elternabend)
 *  info     – nur informativ (Festival, Veranstaltung)
 *  task     – Aufgabe mit Fälligkeit
 *  birthday – Geburtstag (jährlich)
 *  config   – Einstellungen pro Person und Jahr (Urlaubstage)
 *  shop     – Eintrag der Einkaufsliste (title, done)
 */
export type Kind = 'presence' | 'care' | 'cover' | 'event' | 'info' | 'task' | 'birthday' | 'config' | 'shop';
export type Mode = 'homeoffice' | 'vacation' | 'trip';
export type EventSub = 'arzt' | 'schule' | 'elternabend' | 'sonstiges';

export interface Item {
  id: string;
  kind: Kind;
  updated: number; // ms – für Last-Write-Wins beim Sync
  deleted?: boolean;
  by?: PersonId;
  title?: string;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD, inklusive
  time?: string; // HH:MM
  persons: PersonId[];
  mode?: Mode; // presence
  away?: boolean; // presence/vacation: verreist (nicht vor Ort)
  sub?: EventSub; // event
  owner?: PersonId | null; // event/task: wer kümmert sich
  done?: boolean; // task
  note?: string;
  entitlement?: number; // config: Urlaubstage im Jahr
  ts?: number; // shop: Zeitpunkt des Eintragens (Reihenfolge)
  created?: number; // Zeitpunkt des ersten Speicherns (neu vs. geändert)
  endTime?: string; // event/info: Uhrzeit bis (HH:MM)
  place?: string; // event/info: Ort
  link?: string; // event/info: Webadresse
  contact?: string; // event/info: Kontakt / Telefon
}

export interface Span {
  name: string;
  start: string;
  end: string;
  nationwide?: boolean;
}
export interface HolidayData {
  source: string;
  fetchedAt: string;
  holidays: Span[];
  school: Span[];
}

export const MODE_LABEL: Record<Mode | 'office', string> = {
  office: 'Büro',
  homeoffice: 'Homeoffice',
  vacation: 'Urlaub',
  trip: 'Dienstreise',
};
export const SUB_LABEL: Record<EventSub, string> = {
  arzt: 'Arzt',
  schule: 'Schule / Klassenarbeit',
  elternabend: 'Elternabend',
  sonstiges: 'Sonstiges',
};
