import type { Calendar } from './core/calendar';
import { today } from './core/dates';
import { buildWidgetData, type WidgetStyle } from './core/widget';
import { nativeUpdateWidget } from './native';

/** Aktuelle Daten ans Android-Homescreen-Widget schicken (nur in der installierten App). */
export async function pushWidget(cal: Calendar, style: WidgetStyle): Promise<void> {
  const data = buildWidgetData(cal, today(), new Date(), style);
  await nativeUpdateWidget(JSON.stringify(data));
}
