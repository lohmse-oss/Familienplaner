import { Capacitor, registerPlugin } from '@capacitor/core';
import type { Calendar } from './core/calendar';
import { today } from './core/dates';
import { buildWidgetData } from './core/widget';

const FamilyWidget = registerPlugin<{ update(o: { json: string }): Promise<void> }>('FamilyWidget');

/** Aktuelle Daten ans Android-Homescreen-Widget schicken (nur in der installierten App). */
export async function pushWidget(cal: Calendar): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const data = buildWidgetData(cal, today(), new Date());
  await FamilyWidget.update({ json: JSON.stringify(data) });
}
