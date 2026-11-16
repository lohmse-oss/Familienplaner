// Werte werden beim Bauen durch Vite eingesetzt (siehe vite.config.ts).
declare const __APP_VERSION__: string;
declare const __BUILD_NO__: string;
declare const __COMMIT__: string;
declare const __BUILT_AT__: string;

export const BUILD = {
  version: __APP_VERSION__, // z. B. 0.1.23 bzw. 0.3.0 bei einem Versions-Release
  number: __BUILD_NO__, // GitHub-Actions-Laufnummer ('lokal' bei lokalem Build)
  commit: __COMMIT__, // Git-Stand (7 Zeichen)
  builtAt: __BUILT_AT__, // ISO-Zeitpunkt
};
