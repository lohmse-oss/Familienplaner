import { Capacitor } from '@capacitor/core';

/** Kurzes Vibrationsfeedback (nativ über Capacitor, im Browser per Vibration API). */
export async function haptic(kind: 'light' | 'success' = 'light') {
  try {
    if (Capacitor.isNativePlatform()) {
      const { Haptics, ImpactStyle, NotificationType } = await import('@capacitor/haptics');
      if (kind === 'success') await Haptics.notification({ type: NotificationType.Success });
      else await Haptics.impact({ style: ImpactStyle.Light });
    } else navigator.vibrate?.(kind === 'success' ? [12, 40, 12] : 10);
  } catch {
    /* kein Feedback möglich – egal */
  }
}
