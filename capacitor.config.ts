/// <reference types="node" />
// Capacitor configuration (used only when wrapping the app as a native APK).
// This file has no effect on the current web build — it is read by the
// Capacitor CLI (`npx cap ...`) after you install Capacitor locally.
//
// `webDir` must point to the STATIC SPA output (see MIGRACAO_ANDROID.md).
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.lovable.levelup",
  appName: "LevelUp",
  // Static web root produced by `npm run build:android` (index.html + assets/).
  webDir: "dist",
  android: {
    backgroundColor: "#121417",
  },
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_stat_icon",
      iconColor: "#3DDC84",
    },
    SplashScreen: {
      launchShowDuration: 600,
      backgroundColor: "#121417",
    },
  },
};

export default config;
