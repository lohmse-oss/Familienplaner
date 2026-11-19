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
 *  info     – Event (Festival, Konzert, Veranstaltung); away = auswärts statt zuhause/vor Ort
 *  task     – Aufgabe mit Fälligkeit
 *  birthday – Geburtstag (jährlich)
 *  config   – Einstellungen pro Person und Jahr (Urlaubstage)
 *  shop     – Eintrag der Einkaufsliste (title, done)
 *  list     – Checkliste (title) oder Vorlage (template = true)
 *  check    – Punkt einer Checkliste/Vorlage (parent = Id der Liste, title, done) – eigene Einträge, damit beide parallel abhaken können
 *  fact     – Karte der Familien-Infomappe (title, cat, note, contact, link, place; private = nur Eltern)
 */
export type Kind = 'presence' | 'care' | 'cover' | 'event' | 'info' | 'task' | 'birthday' | 'config' | 'shop' | 'list' | 'check' | 'fact';
/** Arten, die nicht im Kalender erscheinen (Listen, Einstellungen, Infomappe). */
export const NON_CALENDAR: Kind[] = ['config', 'shop', 'list', 'check', 'fact'];
export const isCalendarKind = (k: Kind) => !NON_CALENDAR.includes(k);

/** Wiederholung von Aufgaben: beim Abhaken rückt die Fälligkeit um diesen Abstand weiter. */
export type Every = 'week' | '2weeks' | 'month' | 'quarter' | 'year';
export const EVERY_LABEL: Record<Every, string> = { week: 'wöchentlich', '2weeks': 'alle 2 Wochen', month: 'monatlich', quarter: 'vierteljährlich', year: 'jährlich' };

/** Übernahme-Anfrage an den Partner (Termin/Aufgabe). */
export interface Ask {
  from: PersonId;
  to: PersonId;
  state: 'open' | 'declined' | 'accepted';
  at: number; // ms – letzte Änderung der Anfrage
}

export type FactCat = 'kontakt' | 'gesundheit' | 'kita' | 'groessen' | 'dokumente' | 'sonstiges';
export const FACT_CAT_LABEL: Record<FactCat, string> = {
  kontakt: 'Kontakte',
  gesundheit: 'Gesundheit',
  kita: 'Kita & Schule',
  groessen: 'Größen & Kleidung',
  dokumente: 'Dokumente & Verträge',
  sonstiges: 'Sonstiges',
};
export type Mode = 'homeoffice' | 'vacation' | 'trip';
export type EventSub = 'arzt' | 'schule' | 'feier' | 'sport' | 'freizeit' | 'sonstiges';
export type Recur = 'weekly' | 'monthly';
export const RECUR_LABEL: Record<Recur, string> = { weekly: 'wöchentlich', monthly: 'monatlich' };

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
  away?: boolean; // presence/vacation: verreist (nicht vor Ort) · info (Event): auswärts statt zuhause
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
  recur?: Recur; // event: Wiederholung (start = erstes Vorkommen; end leer = ohne Serienende)
  every?: Every; // task: wiederkehrend – Abhaken setzt die nächste Fälligkeit
  ask?: Ask; // event/task: Übernahme-Anfrage an den Partner
  parent?: string; // check: Id der Checkliste
  template?: boolean; // list: Vorlage statt aktiver Checkliste
  cat?: FactCat; // fact: Kategorie der Infomappe
  private?: boolean; // fact: nur für Eltern sichtbar (nicht im Lesezugriff)
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
  schule: 'Schule',
  feier: 'Feier',
  sport: 'Sport',
  freizeit: 'Freizeit',
  sonstiges: 'Sonstiges',
};
