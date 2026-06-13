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
//
// IMPORTANT (Android/APK):
//   - The Capacitor plugin is loaded with a DYNAMIC import and ONLY when
//     running natively (Capacitor.isNativePlatform() === true). This keeps the
//     web/SSR bundle from ever touching native-only code.
//   - A notification channel ("levelup_reminders") is created BEFORE any
//     schedule() call (required on Android 8+).
//   - Listeners are registered exactly ONCE (in init()).
//   - Every error is captured with stage + message + stack + timestamp.
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

const CHANNEL_ID = "levelup_reminders";

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

/** Capture an error with full context (stage + message + stack + time). */
function captureError(stage: string, e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  const stack = e instanceof Error && e.stack ? `\n${e.stack.split("\n").slice(0, 3).join("\n")}` : "";
  const detail = `[${stage}] ${msg}${stack}`;
  lastNativeError = detail;
  log("error", stage, detail);
  return detail;
}

/** Current delivery mode based on the runtime platform. */
export function getNotificationMode(): NotificationMode {
  return isNativePlatform() ? "android" : "web";
}

// ----------------------------------------------------------------------------
// Capacitor (ANDROID) adapter.
// ----------------------------------------------------------------------------

type PermStatus = { display: string };

type LocalNotificationsPlugin = {
  requestPermissions: () => Promise<PermStatus>;
  checkPermissions: () => Promise<PermStatus>;
  createChannel: (opts: {
    id: string;
    name: string;
    description?: string;
    importance?: number;
    visibility?: number;
    sound?: string;
    vibration?: boolean;
    lights?: boolean;
  }) => Promise<void>;
  schedule: (opts: {
    notifications: Array<{
      id: number;
      title: string;
      body: string;
      channelId?: string;
      schedule?: { at: Date; allowWhileIdle?: boolean };
    }>;
  }) => Promise<void>;
  cancel: (opts: { notifications: Array<{ id: number }> }) => Promise<void>;
  getPending?: () => Promise<{ notifications: Array<{ id: number }> }>;
  addListener: (event: string, cb: (data: unknown) => void) => Promise<unknown> | unknown;
};

let nativePluginPromise: Promise<LocalNotificationsPlugin | null> | null = null;
let lastNativeError: string | null = null;
let channelCreated = false;
let listenersRegistered = false;
let lastCheckRaw = "";
let lastRequestRaw = "";

async function loadNativePlugin(): Promise<LocalNotificationsPlugin | null> {
  if (getNotificationMode() !== "android") return null;
  if (!nativePluginPromise) {
    nativePluginPromise = (async () => {
      try {
        // Dynamic import — only ever reached inside the native Android shell.
        const mod = await import("@capacitor/local-notifications");
        const plugin = (mod.LocalNotifications ?? null) as unknown as LocalNotificationsPlugin | null;
        if (!plugin) {
          lastNativeError = "Módulo carregado mas LocalNotifications ausente.";
          log("error", "Capacitor", lastNativeError);
        } else {
          lastNativeError = null;
        }
        return plugin;
      } catch (e) {
        captureError("import-plugin", e);
        nativePluginPromise = null; // allow retry later
        return null;
      }
    })();
  }
  return nativePluginPromise;
}

/** Create the Android notification channel once (idempotent). */
async function ensureChannel(plugin: LocalNotificationsPlugin): Promise<boolean> {
  if (channelCreated) return true;
  try {
    await plugin.createChannel({
      id: CHANNEL_ID,
      name: "LevelUp Lembretes",
      description: "Lembretes de rotina, estudo, treino e hábitos",
      importance: 5, // máxima (heads-up)
      visibility: 1, // público
      sound: "default",
      vibration: true,
      lights: true,
    });
    channelCreated = true;
    log("service_worker", "Canal Android", `Canal "${CHANNEL_ID}" criado/garantido`);
    return true;
  } catch (e) {
    captureError("create-channel", e);
    return false;
  }
}

/** Register native listeners exactly once. */
async function registerListeners(plugin: LocalNotificationsPlugin) {
  if (listenersRegistered) return;
  listenersRegistered = true;
  try {
    await plugin.addListener("localNotificationReceived", (data: unknown) => {
      const n = data as { title?: string } | undefined;
      log("received", n?.title ?? "Notificação", "Recebida (nativa)");
    });
    await plugin.addListener("localNotificationActionPerformed", (data: unknown) => {
      const n = data as { notification?: { title?: string } } | undefined;
      log("received", n?.notification?.title ?? "Notificação", "Toque/ação na notificação");
    });
    log("service_worker", "Listeners", "Listeners nativos registrados");
  } catch (e) {
    captureError("add-listener", e);
  }
}

/** Ensure permission is granted: check → request if needed → check again. */
async function ensureNativePermission(
  plugin: LocalNotificationsPlugin,
): Promise<"granted" | "denied" | "default"> {
  try {
    let res = await plugin.checkPermissions();
    lastCheckRaw = JSON.stringify(res);
    log("permission", "checkPermissions", lastCheckRaw);
    if (res.display !== "granted") {
      const req = await plugin.requestPermissions();
      lastRequestRaw = JSON.stringify(req);
      log("permission", "requestPermissions", lastRequestRaw);
      res = await plugin.checkPermissions();
      lastCheckRaw = JSON.stringify(res);
      log("permission", "checkPermissions (re)", lastCheckRaw);
    }
    return res.display === "granted" ? "granted" : res.display === "denied" ? "denied" : "default";
  } catch (e) {
    captureError("ensure-permission", e);
    return "default";
  }
}

/** Diagnostic snapshot of the native notification adapter. */
export async function getNativePluginStatus(): Promise<{
  mode: NotificationMode;
  pluginAvailable: boolean;
  permission: "granted" | "denied" | "default" | "unsupported";
  channelCreated: boolean;
  listenersRegistered: boolean;
  pendingCount: number;
  checkRaw: string;
  requestRaw: string;
  lastError: string | null;
}> {
  const mode = getNotificationMode();
  if (mode !== "android") {
    return {
      mode,
      pluginAvailable: false,
      permission: "unsupported",
      channelCreated: false,
      listenersRegistered: false,
      pendingCount: 0,
      checkRaw: "",
      requestRaw: "",
      lastError: null,
    };
  }
  const plugin = await loadNativePlugin();
  let permission: "granted" | "denied" | "default" | "unsupported" = "unsupported";
  let pendingCount = 0;
  if (plugin) {
    try {
      const res = await plugin.checkPermissions();
      lastCheckRaw = JSON.stringify(res);
      permission =
        res.display === "granted" ? "granted" : res.display === "denied" ? "denied" : "default";
    } catch (e) {
      captureError("status-check", e);
      permission = "default";
    }
    try {
      const pend = (await plugin.getPending?.()) ?? { notifications: [] };
      pendingCount = pend.notifications.length;
    } catch {
      /* getPending optional */
    }
  }
  return {
    mode,
    pluginAvailable: !!plugin,
    permission,
    channelCreated,
    listenersRegistered,
    pendingCount,
    checkRaw: lastCheckRaw,
    requestRaw: lastRequestRaw,
    lastError: lastNativeError,
  };
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
      if (plugin) {
        await ensureChannel(plugin);
        await registerListeners(plugin);
        log("service_worker", "NotificationService", "Modo Android (Capacitor) ativo");
      }
      return;
    }
    await webInit();
  },

  /** Request OS permission for notifications (full check → request → check). */
  async requestPermission(): Promise<"granted" | "denied" | "default" | "unsupported"> {
    if (getNotificationMode() === "android") {
      const plugin = await loadNativePlugin();
      if (!plugin) return "unsupported";
      const r = await ensureNativePermission(plugin);
      if (r === "granted") await ensureChannel(plugin);
      return r;
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
        lastCheckRaw = JSON.stringify(res);
        return res.display === "granted" ? "granted" : res.display === "denied" ? "denied" : "default";
      } catch (e) {
        captureError("current-permission", e);
        return "default";
      }
    }
    const r = webCurrentPermission();
    return r === "unsupported" ? "unsupported" : r;
  },

  /** Fire a notification (native: ~2s later via schedule; web: immediate). */
  async notify(title: string, body: string, options: NotifyOptions = {}): Promise<NotifyResult> {
    if (getNotificationMode() === "android") {
      const plugin = await loadNativePlugin();
      if (!plugin) return { ok: false, mode: "android", message: "Plugin nativo indisponível" };
      const perm = await ensureNativePermission(plugin);
      if (perm !== "granted") {
        return { ok: false, mode: "android", message: `Permissão: ${perm}` };
      }
      await ensureChannel(plugin);
      try {
        const id = toNativeId(options.tag ?? nUid());
        log("sent", title, "Agendada via Capacitor (imediata ~2s)");
        await plugin.schedule({
          notifications: [
            {
              id,
              title,
              body,
              channelId: CHANNEL_ID,
              schedule: { at: new Date(Date.now() + 2000), allowWhileIdle: true },
            },
          ],
        });
        return { ok: true, mode: "android", message: "Notificação nativa agendada (2s)" };
      } catch (e) {
        const detail = captureError("notify-schedule", e);
        return { ok: false, mode: "android", message: "Erro nativo ao agendar", detail };
      }
    }
    const r = await webFire(title, body, options);
    return { ok: r.ok, mode: "web", message: r.message, detail: r.detail };
  },

  /** Schedule a notification after `delayMs`. Returns an id usable with cancel(). */
  async schedule(title: string, body: string, delayMs: number): Promise<string> {
    if (getNotificationMode() === "android") {
      const id = nUid();
      const plugin = await loadNativePlugin();
      if (!plugin) {
        log("error", title, "Plugin nativo indisponível ao agendar");
        return id;
      }
      const perm = await ensureNativePermission(plugin);
      if (perm !== "granted") {
        log("error", title, `Agendamento cancelado — permissão: ${perm}`);
        return id;
      }
      await ensureChannel(plugin);
      try {
        const sc: ScheduledNotif = { id, fireAt: Date.now() + delayMs, title, body };
        useStore.getState().addScheduled(sc);
        await plugin.schedule({
          notifications: [
            {
              id: toNativeId(id),
              title,
              body,
              channelId: CHANNEL_ID,
              schedule: { at: new Date(sc.fireAt), allowWhileIdle: true },
            },
          ],
        });
        log("scheduled", title, `Android: dispara em ${Math.round(delayMs / 1000)}s`);
      } catch (e) {
        captureError("schedule", e);
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
          captureError("cancel", e);
        }
      }
      return;
    }
    webCancel(id);
  },
};

export type NotificationService = typeof notificationService;
