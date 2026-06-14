import { Capacitor } from "@capacitor/core";

export type AppPlatform = "web" | "android" | "ios";

export function isNativePlatform(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function getPlatform(): AppPlatform {
  try {
    const platform = Capacitor.getPlatform();

    if (platform === "android") return "android";
    if (platform === "ios") return "ios";

    return "web";
  } catch {
    return "web";
  }
}

export function hasCapacitorPlugin(name: string): boolean {
  try {
    return Capacitor.isPluginAvailable(name);
  } catch {
    return false;
  }
}
