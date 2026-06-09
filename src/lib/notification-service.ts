// ============================================================================
// NotificationService — single abstraction layer for ALL notifications.
//
// Every feature in the app MUST go through this service instead of calling
// `Notification`, the Service Worker, or Capacitor plugins directly.
//
//   WEB     -> Service Worker (ServiceWorkerRegistration.showNotification)
//   ANDROID -> Capacitor Local Notifications (native AlarmManager)
//
// The mode is selected automatically via isNativePlatform().
// On web today everything routes to the existing, battle-tested web engine in
// `notify.ts`. When the app is later wrapped with Capacitor, the same calls are
// transparently served by native local notifications — no feature code changes.
// ============================================================================

import { isNativePlatform } from "./platform";
import {
  fireNotification as webFire,
  scheduleNotification as webSchedule,
  cancelScheduled as webCancel,
  requestNotificationPermission as webRequestPermission,
  initNotificationRuntime as webInit,
  currentPermission as webCurrentPermission,
} from "./notify";
import { useStore, type ScheduledNotif } from "./store";

export type NotificationMode = "web" | "android";

export interface NotifyOptions {
  tag?: string;
  reason?: string;
  fallbackToast?: boolean;
}

export interface NotifyResult {
  ok: boolean;
  mode: NotificationMode;
  message: string;
  detail?: string;
}

const nUid = () => Math.random().toString(36).slice(2, 10);

function log(
  kind: Parameters<ReturnType<typeof useStore.getState>["logNotif"]>[0],
  title: string,
  detail?: string,
) {
  try {
    useStore.getState().logNotif(kind, title, detail);
  } catch {
    /* store not ready */
  }
}

/** Current delivery mode based on the runtime platform. */
export function getNotificationMode(): NotificationMode {
  return isNativePlatform() ? "android" : "web";
}

// ----------------------------------------------------------------------------
// Capacitor (ANDROID) adapter — lazily loaded so the web bundle never imports
// the native plugin. The specifier is built dynamically so the web build does
// not try to resolve `@capacitor/local-notifications` at build time.
// ----------------------------------------------------------------------------

type LocalNotificationsPlugin = {
  requestPermissions: () => Promise<{ display: string }>;
  checkPermissions: () => Promise<{ display: string }>;
  schedule: (opts: {
    notifications: Array<{
      id: number;
      title: string;
      body: string;
      schedule?: { at: Date };
    }>;
  }) => Promise<void>;
  cancel: (opts: { notifications: Array<{ id: number }> }) => Promise<void>;
};

let nativePluginPromise: Promise<LocalNotificationsPlugin | null> | null = null;

async function loadNativePlugin(): Promise<LocalNotificationsPlugin | null> {
  if (!nativePluginPromise) {
    nativePluginPromise = (async () => {
      try {
        const specifier = ["@capacitor", "local-notifications"].join("/");
        const mod = (await import(/* @vite-ignore */ specifier)) as {
          LocalNotifications?: LocalNotificationsPlugin;
        };
        return mod.LocalNotifications ?? null;
      } catch (e) {
        log("error", "Capacitor", `Plugin local-notifications indisponível: ${String(e)}`);
        return null;
      }
    })();
  }
  return nativePluginPromise;
}

// Capacitor notification ids are 32-bit ints; keep a string<->int map for cancel().
const nativeIdMap = new Map<string, number>();
function toNativeId(id: string): number {
  const existing = nativeIdMap.get(id);
  if (existing != null) return existing;
  const n = Math.floor(Math.random() * 2_000_000_000) + 1;
  nativeIdMap.set(id, n);
  return n;
}

// ----------------------------------------------------------------------------
// Public service API
// ----------------------------------------------------------------------------

export const notificationService = {
  /** Bootstrap the active engine. Call once on app start. */
  async init(): Promise<void> {
    if (getNotificationMode() === "android") {
      const plugin = await loadNativePlugin();
      if (plugin) log("service_worker", "NotificationService", "Modo Android (Capacitor) ativo");
      return;
    }
    await webInit();
  },

  /** Request OS permission for notifications. */
  async requestPermission(): Promise<"granted" | "denied" | "default" | "unsupported"> {
    if (getNotificationMode() === "android") {
      const plugin = await loadNativePlugin();
      if (!plugin) return "unsupported";
      try {
        const res = await plugin.requestPermissions();
        const granted = res.display === "granted";
        log("permission", "Permissão", `Android: ${res.display}`);
        return granted ? "granted" : "denied";
      } catch (e) {
        log("error", "Permissão", `Android falhou: ${String(e)}`);
        return "denied";
      }
    }
    const r = await webRequestPermission();
    return r === "unsupported" ? "unsupported" : r;
  },

  /** Current permission state without prompting. */
  async currentPermission(): Promise<"granted" | "denied" | "default" | "unsupported"> {
    if (getNotificationMode() === "android") {
      const plugin = await loadNativePlugin();
      if (!plugin) return "unsupported";
      try {
        const res = await plugin.checkPermissions();
        return res.display === "granted" ? "granted" : res.display === "denied" ? "denied" : "default";
      } catch {
        return "default";
      }
    }
    const r = webCurrentPermission();
    return r === "unsupported" ? "unsupported" : r;
  },

  /** Fire an immediate notification. */
  async notify(title: string, body: string, options: NotifyOptions = {}): Promise<NotifyResult> {
    if (getNotificationMode() === "android") {
      const plugin = await loadNativePlugin();
      if (!plugin) return { ok: false, mode: "android", message: "Plugin indisponível" };
      try {
        const id = toNativeId(options.tag ?? nUid());
        log("sent", title, "Solicitada via Capacitor");
        await plugin.schedule({ notifications: [{ id, title, body }] });
        log("received", title, "Notificação nativa criada");
        return { ok: true, mode: "android", message: "Notificação nativa criada" };
      } catch (e) {
        return { ok: false, mode: "android", message: "Erro nativo", detail: String(e) };
      }
    }
    const r = await webFire(title, body, options);
    return { ok: r.ok, mode: "web", message: r.message, detail: r.detail };
  },

  /** Schedule a notification after `delayMs`. Returns an id usable with cancel(). */
  async schedule(title: string, body: string, delayMs: number): Promise<string> {
    if (getNotificationMode() === "android") {
      const plugin = await loadNativePlugin();
      const id = nUid();
      if (!plugin) return id;
      try {
        const sc: ScheduledNotif = { id, fireAt: Date.now() + delayMs, title, body };
        useStore.getState().addScheduled(sc);
        await plugin.schedule({
          notifications: [{ id: toNativeId(id), title, body, schedule: { at: new Date(sc.fireAt) } }],
        });
        log("scheduled", title, `Android: ${Math.round(delayMs / 1000)}s`);
      } catch (e) {
        log("error", title, `Falha ao agendar nativo: ${String(e)}`);
      }
      return id;
    }
    return webSchedule(title, body, delayMs);
  },

  /** Cancel a scheduled notification by id. */
  async cancel(id: string): Promise<void> {
    if (getNotificationMode() === "android") {
      const plugin = await loadNativePlugin();
      useStore.getState().removeScheduled(id);
      if (plugin && nativeIdMap.has(id)) {
        try {
          await plugin.cancel({ notifications: [{ id: toNativeId(id) }] });
          log("cancelled", "Agendamento", "Cancelado (Android)");
        } catch (e) {
          log("error", "Agendamento", `Falha ao cancelar nativo: ${String(e)}`);
        }
      }
      return;
    }
    webCancel(id);
  },
};

export type NotificationService = typeof notificationService;
