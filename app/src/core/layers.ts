import type { DayInfo } from './calendar';

/** Welche Arten von Einträgen der Kalender zusätzlich zu Anwesenheit/Betreuung zeigt. */
export interface Layers {
  events: boolean;
  tasks: boolean;
  birthdays: boolean;
}
export const ALL_LAYERS: Layers = { events: true, tasks: true, birthdays: true };

export interface DayMarks {
  events: number; // Termine
  tasks: number; // offene Aufgaben, die an diesem Tag fällig sind
  overdue: boolean; // mindestens eine davon ist überfällig
  birthdays: number;
  info: number; // Infos (Festival, Veranstaltung)
  total: number;
}

/** Marker eines Tages für die Kalenderansichten – nach den gewählten Ebenen. */
export function marksOf(d: DayInfo, today: string, layers: Layers = ALL_LAYERS): DayMarks {
  const tasks = layers.tasks ? d.tasks.filter((t) => !t.done) : [];
  const m: DayMarks = {
    events: layers.events ? d.events.length : 0,
    tasks: tasks.length,
    overdue: tasks.length > 0 && d.date < today,
    birthdays: layers.birthdays ? d.birthdays.length : 0,
    info: layers.events ? d.info.length : 0,
    total: 0,
  };
  m.total = m.events + m.tasks + m.birthdays + m.info;
  return m;
}
