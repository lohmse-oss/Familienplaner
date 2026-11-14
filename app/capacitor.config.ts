import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'de.familie.planer',
  appName: 'Familienplaner',
  webDir: 'dist',
  android: { allowMixedContent: false },
};
export default config;
