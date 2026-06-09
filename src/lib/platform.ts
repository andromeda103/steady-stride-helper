// Platform detection layer.
// Works on plain web (browser/PWA) today and on Capacitor (Android/iOS) in the future.
// Capacitor injects a global `window.Capacitor` object at runtime inside the native WebView.

type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: Record<string, unknown>;
};

function getCapacitor(): CapacitorGlobal | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
}

/** True when running inside a Capacitor native shell (Android/iOS APK). */
export function isNativePlatform(): boolean {
  const cap = getCapacitor();
  try {
    return !!cap?.isNativePlatform?.();
  } catch {
    return false;
  }
}

/** "web" | "android" | "ios" — defaults to "web" in browsers and during SSR. */
export function getPlatform(): "web" | "android" | "ios" {
  const cap = getCapacitor();
  const p = (() => {
    try {
      return cap?.getPlatform?.();
    } catch {
      return undefined;
    }
  })();
  if (p === "android") return "android";
  if (p === "ios") return "ios";
  return "web";
}

/** Whether a given Capacitor plugin is available at runtime. */
export function hasCapacitorPlugin(name: string): boolean {
  const cap = getCapacitor();
  return !!cap?.Plugins?.[name];
}
