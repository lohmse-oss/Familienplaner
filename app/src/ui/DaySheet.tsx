import type { Item, Kind } from '../core/types';
import { Sheet } from './common';
import { DayContent } from './DayContent';

export function DaySheet({ date, onClose, edit, add }: { date: string; onClose: () => void; edit: (it: Item) => void; add: (k: Kind, date: string) => void }) {
  return (
    <Sheet title="Tag" onClose={onClose}>
      <DayContent date={date} edit={edit} add={add} />
    </Sheet>
  );
}
