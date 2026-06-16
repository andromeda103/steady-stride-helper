// ============================================================================
// notification-service.ts — SINGLE central notification layer for the app.
//
// Every feature (rotina, estudos, hábitos, lembretes, diagnóstico) MUST go
// through this module. There is exactly ONE public API and ONE decision point:
//
//   if (Capacitor.isNativePlatform())  -> @capacitor/local-notifications
//   else                               -> Web Notifications / Service Worker
//
// Hard rules enforced here:
//   - Platform is read LIVE at the moment of every operation (never a
//     module-load constant) — safe for SSR / prerender / hydration.
//   - The native plugin is imported with a DYNAMIC import, gated ONLY by
//     `Capacitor.isNativePlatform()` (+ android/ios). `isPluginAvailable()`
//     is DIAGNOSTIC ONLY and never blocks the import.
//   - Every native call is wrapped in a 10s timeout so the UI never hangs.
//   - Listeners are registered exactly once (singleton promise).
//   - No empty catch blocks — every error is captured with full context.
// ============================================================================

import { Capacitor } from "@capacitor/core";
import {
  fireNotification as webFire,
  scheduleNotification as webSchedule,
  cancelScheduled as webCancel,
  requestNotificationPermission as webRequestPermission,
  initNotificationRuntime as webInit,
  currentPermission as webCurrentPermission,
} from "./notify";
import { useStore, type ScheduledNotif } from "./store";

export type NotificationMode = "web" | "android" | "ios";
export type PermissionState = "granted" | "denied" | "default" | "unsupported";

const CHANNEL_ID = "levelup_reminders";
const TIMEOUT_MS = 10_000;

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

// ----------------------------------------------------------------------------
// LIVE platform detection — read at every call, never cached at module scope.
// ----------------------------------------------------------------------------

export function isNativeRuntime(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function getRuntimePlatform(): "web" | "android" | "ios" {
  try {
    const p = Capacitor.getPlatform();
    return p === "android" ? "android" : p === "ios" ? "ios" : "web";
  } catch {
    return "web";
  }
}

export function isAndroidRuntime(): boolean {
  return isNativeRuntime() && getRuntimePlatform() === "android";
}

/** Diagnostic only — NEVER used to block the native import. */
export function pluginReportedAvailable(): boolean {
  try {
    return Capacitor.isPluginAvailable("LocalNotifications");
  } catch {
    return false;
  }
}

/** The single source of truth for which engine handles a request. */
function shouldUseNative(): boolean {
  return isNativeRuntime() && (getRuntimePlatform() === "android" || getRuntimePlatform() === "ios");
}

/** Current delivery mode based on the LIVE runtime platform. */
export function getNotificationMode(): NotificationMode {
  if (!shouldUseNative()) return "web";
  return getRuntimePlatform() === "ios" ? "ios" : "android";
}

export interface NotificationRuntime {
  native: boolean;
  platform: "web" | "android" | "ios";
  pluginReportedAvailable: boolean;
  selectedMethod: "native" | "web";
}

export function getNotificationRuntime(): NotificationRuntime {
  const native = isNativeRuntime();
  return {
    native,
    platform: getRuntimePlatform(),
    pluginReportedAvailable: pluginReportedAvailable(),
    selectedMethod: native ? "native" : "web",
  };
}

// ----------------------------------------------------------------------------
// Logging + error capture (never silent).
// ----------------------------------------------------------------------------

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

let lastNativeError: string | null = null;

function captureError(stage: string, e: unknown): string {
  const err = e instanceof Error ? e : new Error(String(e));
  const stack = err.stack ? `\n${err.stack.split("\n").slice(0, 3).join("\n")}` : "";
  const cause = (err as { cause?: unknown }).cause;
  const detail =
    `[${new Date().toISOString()}] [${stage}] native=${isNativeRuntime()} platform=${getRuntimePlatform()} ` +
    `plugin=${pluginReportedAvailable()} ${err.name}: ${err.message}` +
    (cause ? ` (cause: ${String(cause)})` : "") +
    stack;
  lastNativeError = detail;
  log("error", stage, detail);
  // eslint-disable-next-line no-console
  console.error("[LEVELUP-NOTIFY]", stage, detail);
  return detail;
}

async function withTimeout<T>(promise: Promise<T>, stage: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Operação nativa não respondeu em ${TIMEOUT_MS / 1000}s (etapa: ${stage})`));
    }, TIMEOUT_MS);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// ----------------------------------------------------------------------------
// Native plugin typing + dynamic import (NOT gated by isPluginAvailable).
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
      extra?: Record<string, unknown>;
    }>;
  }) => Promise<void>;
  cancel: (opts: { notifications: Array<{ id: number }> }) => Promise<void>;
  getPending: () => Promise<{ notifications: Array<{ id: number }> }>;
  addListener: (event: string, cb: (data: unknown) => void) => Promise<unknown> | unknown;
};

let channelCreated = false;

/**
 * Import the native plugin DIRECTLY. The only gate is the LIVE runtime check;
 * `isPluginAvailable()` is intentionally NOT consulted here so a transient
 * bridge/timing false-negative can never silently force the web fallback.
 */
async function getNativeNotificationsPlugin(): Promise<LocalNotificationsPlugin> {
  const nativeNow = isNativeRuntime();
  const platformNow = getRuntimePlatform();
  if (!nativeNow) {
    throw new Error("Plugin nativo solicitado fora do runtime Capacitor");
  }
  if (platformNow !== "android" && platformNow !== "ios") {
    throw new Error(`Plataforma nativa inválida: ${platformNow}`);
  }
  const mod = await withTimeout(import("@capacitor/local-notifications"), "plugin-import");
  const plugin = (mod as { LocalNotifications?: unknown }).LocalNotifications as
    | LocalNotificationsPlugin
    | undefined;
  if (!plugin) {
    throw new Error("Módulo carregado, mas LocalNotifications está ausente no export.");
  }
  return plugin;
}

/** Create the Android notification channel once (idempotent). */
async function ensureChannel(plugin: LocalNotificationsPlugin): Promise<boolean> {
  if (channelCreated) return true;
  if (getRuntimePlatform() !== "android") {
    channelCreated = true; // channels are Android-only
    return true;
  }
  try {
    await withTimeout(
      plugin.createChannel({
        id: CHANNEL_ID,
        name: "LevelUp Lembretes",
        description: "Lembretes de rotina, estudo, treino e hábitos",
        importance: 5,
        visibility: 1,
        sound: "default",
        vibration: true,
        lights: true,
      }),
      "create-channel",
    );
    channelCreated = true;
    log("service_worker", "Canal Android", `Canal "${CHANNEL_ID}" criado/garantido`);
    return true;
  } catch (e) {
    captureError("create-channel", e);
    return false;
  }
}

// ----------------------------------------------------------------------------
// Listeners — registered exactly once (singleton promise).
// ----------------------------------------------------------------------------

let listenersInitializationPromise: Promise<void> | null = null;
let listenersRegistered = false;

export function initializeNotificationListeners(): Promise<void> {
  if (listenersInitializationPromise) return listenersInitializationPromise;
  listenersInitializationPromise = (async () => {
    if (!shouldUseNative()) return;
    try {
      const plugin = await getNativeNotificationsPlugin();
      await plugin.addListener("localNotificationReceived", (data: unknown) => {
        const n = data as { title?: string } | undefined;
        log("received", n?.title ?? "Notificação", "Recebida (nativa)");
      });
      await plugin.addListener("localNotificationActionPerformed", (data: unknown) => {
        const n = data as { notification?: { title?: string } } | undefined;
        log("received", n?.notification?.title ?? "Notificação", "Toque/ação na notificação");
      });
      listenersRegistered = true;
      log("service_worker", "Listeners", "Listeners nativos registrados (uma vez)");
    } catch (e) {
      captureError("init-listeners", e);
      listenersInitializationPromise = null; // allow retry
    }
  })();
  return listenersInitializationPromise;
}

export function listenersAreRegistered(): boolean {
  return listenersRegistered;
}

// ----------------------------------------------------------------------------
// Permission flow (native plugin only on device; web API only in browser).
// ----------------------------------------------------------------------------

function toPermissionState(display: string): "granted" | "denied" | "default" {
  return display === "granted" ? "granted" : display === "denied" ? "denied" : "default";
}

async function ensureNativePermission(plugin: LocalNotificationsPlugin): Promise<PermissionState> {
  try {
    let res = await withTimeout(plugin.checkPermissions(), "check-permissions");
    log("permission", "checkPermissions", JSON.stringify(res));
    if (res.display !== "granted") {
      const req = await withTimeout(plugin.requestPermissions(), "request-permissions");
      log("permission", "requestPermissions", JSON.stringify(req));
      res = await withTimeout(plugin.checkPermissions(), "check-permissions-2");
      log("permission", "checkPermissions (re)", JSON.stringify(res));
    }
    return toPermissionState(res.display);
  } catch (e) {
    captureError("ensure-permission", e);
    return "default";
  }
}

export async function checkNotificationPermission(): Promise<PermissionState> {
  if (shouldUseNative()) {
    try {
      const plugin = await getNativeNotificationsPlugin();
      const res = await withTimeout(plugin.checkPermissions(), "check-permissions");
      return toPermissionState(res.display);
    } catch (e) {
      captureError("check-permission", e);
      return "default";
    }
  }
  const r = webCurrentPermission();
  return r === "unsupported" ? "unsupported" : (r as PermissionState);
}

export async function requestNotificationPermission(): Promise<PermissionState> {
  if (shouldUseNative()) {
    try {
      const plugin = await getNativeNotificationsPlugin();
      const r = await ensureNativePermission(plugin);
      if (r === "granted") await ensureChannel(plugin);
      return r;
    } catch (e) {
      captureError("request-permission", e);
      return "default";
    }
  }
  const r = await webRequestPermission();
  return r === "unsupported" ? "unsupported" : (r as PermissionState);
}

export async function ensureNotificationPermission(): Promise<PermissionState> {
  const current = await checkNotificationPermission();
  if (current === "granted") return "granted";
  return requestNotificationPermission();
}

export async function createNotificationChannel(): Promise<boolean> {
  if (!shouldUseNative()) return false;
  try {
    const plugin = await getNativeNotificationsPlugin();
    return ensureChannel(plugin);
  } catch (e) {
    captureError("create-channel", e);
    return false;
  }
}

// ----------------------------------------------------------------------------
// Stable ids — deterministic per (key) so cancel/reschedule stays consistent
// across app restarts (NEVER a counter that resets to 1).
// ----------------------------------------------------------------------------

/** Hash an arbitrary string key into a stable positive 31-bit int for Android. */
export function stableNotificationId(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // keep within a safe positive range, above the reserved test ids (10001-10003)
  return (Math.abs(h) % 2_000_000_000) + 20000;
}

const nativeIdMap = new Map<string, number>();
function toNativeId(id: string): number {
  const existing = nativeIdMap.get(id);
  if (existing != null) return existing;
  const n = stableNotificationId(id);
  nativeIdMap.set(id, n);
  return n;
}

// ----------------------------------------------------------------------------
// Schedule / cancel (central).
// ----------------------------------------------------------------------------

export async function getPendingNotifications(): Promise<number[]> {
  if (!shouldUseNative()) return [];
  try {
    const plugin = await getNativeNotificationsPlugin();
    const pend = await withTimeout(plugin.getPending(), "get-pending");
    return pend.notifications.map((n) => n.id);
  } catch (e) {
    captureError("get-pending", e);
    return [];
  }
}

export async function cancelNotification(id: string): Promise<void> {
  if (shouldUseNative()) {
    useStore.getState().removeScheduled(id);
    if (!nativeIdMap.has(id)) return;
    try {
      const plugin = await getNativeNotificationsPlugin();
      await withTimeout(plugin.cancel({ notifications: [{ id: toNativeId(id) }] }), "cancel");
      log("cancelled", "Agendamento", "Cancelado (nativo)");
    } catch (e) {
      captureError("cancel", e);
    }
    return;
  }
  webCancel(id);
}

export async function cancelAllNotifications(): Promise<void> {
  if (shouldUseNative()) {
    try {
      const plugin = await getNativeNotificationsPlugin();
      const pend = await withTimeout(plugin.getPending(), "get-pending");
      if (pend.notifications.length > 0) {
        await withTimeout(plugin.cancel({ notifications: pend.notifications.map((n) => ({ id: n.id })) }), "cancel-all");
      }
      log("cancelled", "Agendamentos", "Todos cancelados (nativo)");
    } catch (e) {
      captureError("cancel-all", e);
    }
    return;
  }
  for (const s of useStore.getState().scheduled) webCancel(s.id);
}

// ----------------------------------------------------------------------------
// Public service object (backwards-compatible facade used across the app).
// ----------------------------------------------------------------------------

export const notificationService = {
  /** Bootstrap the active engine. Call once on app start. */
  async init(): Promise<void> {
    if (shouldUseNative()) {
      try {
        const plugin = await getNativeNotificationsPlugin();
        await ensureChannel(plugin);
        await initializeNotificationListeners();
        log("service_worker", "NotificationService", `Modo nativo (${getRuntimePlatform()}) ativo`);
      } catch (e) {
        captureError("init", e);
      }
      return;
    }
    await webInit();
  },

  async requestPermission(): Promise<PermissionState> {
    return requestNotificationPermission();
  },

  async currentPermission(): Promise<PermissionState> {
    return checkNotificationPermission();
  },

  /** Fire a notification (native: ~2s later via schedule; web: immediate). */
  async notify(title: string, body: string, options: NotifyOptions = {}): Promise<NotifyResult> {
    if (shouldUseNative()) {
      const mode = getNotificationMode();
      try {
        const plugin = await getNativeNotificationsPlugin();
        const perm = await ensureNativePermission(plugin);
        if (perm !== "granted") {
          return { ok: false, mode, message: `Permissão: ${perm}` };
        }
        await ensureChannel(plugin);
        const id = toNativeId(options.tag ?? nUid());
        await withTimeout(
          plugin.schedule({
            notifications: [
              {
                id,
                title,
                body,
                channelId: CHANNEL_ID,
                schedule: { at: new Date(Date.now() + 2000), allowWhileIdle: true },
                extra: { source: "levelup", reason: options.reason },
              },
            ],
          }),
          "notify-schedule",
        );
        log("sent", title, "Agendada via Capacitor (~2s)");
        return { ok: true, mode, message: "Notificação nativa agendada (2s)" };
      } catch (e) {
        const detail = captureError("notify", e);
        return { ok: false, mode, message: "Erro nativo ao agendar", detail };
      }
    }
    const r = await webFire(title, body, options);
    return { ok: r.ok, mode: "web", message: r.message, detail: r.detail };
  },

  /** Schedule a notification after `delayMs`. Returns an id usable with cancel(). */
  async schedule(title: string, body: string, delayMs: number): Promise<string> {
    if (shouldUseNative()) {
      const id = nUid();
      try {
        const plugin = await getNativeNotificationsPlugin();
        const perm = await ensureNativePermission(plugin);
        if (perm !== "granted") {
          log("error", title, `Agendamento cancelado — permissão: ${perm}`);
          return id;
        }
        await ensureChannel(plugin);
        const sc: ScheduledNotif = { id, fireAt: Date.now() + delayMs, title, body };
        useStore.getState().addScheduled(sc);
        await withTimeout(
          plugin.schedule({
            notifications: [
              {
                id: toNativeId(id),
                title,
                body,
                channelId: CHANNEL_ID,
                schedule: { at: new Date(sc.fireAt), allowWhileIdle: true },
              },
            ],
          }),
          "schedule",
        );
        log("scheduled", title, `Nativo: dispara em ${Math.round(delayMs / 1000)}s`);
      } catch (e) {
        captureError("schedule", e);
      }
      return id;
    }
    return webSchedule(title, body, delayMs);
  },

  async cancel(id: string): Promise<void> {
    return cancelNotification(id);
  },
};

// Central alias so feature code can import a single explicit function name.
export async function scheduleNotification(title: string, body: string, delayMs: number): Promise<string> {
  return notificationService.schedule(title, body, delayMs);
}

// ----------------------------------------------------------------------------
// Diagnostics snapshot (timeout-protected — never hangs the screen).
// ----------------------------------------------------------------------------

export interface NativePluginStatus {
  mode: NotificationMode;
  native: boolean;
  platform: "web" | "android" | "ios";
  selectedMethod: "native" | "web";
  pluginReportedAvailable: boolean;
  pluginImported: boolean;
  permission: PermissionState;
  channelCreated: boolean;
  listenersRegistered: boolean;
  pendingCount: number;
  lastError: string | null;
}

export async function getNativePluginStatus(): Promise<NativePluginStatus> {
  const native = isNativeRuntime();
  const platform = getRuntimePlatform();
  const base: NativePluginStatus = {
    mode: getNotificationMode(),
    native,
    platform,
    selectedMethod: native ? "native" : "web",
    pluginReportedAvailable: pluginReportedAvailable(),
    pluginImported: false,
    permission: "unsupported",
    channelCreated,
    listenersRegistered,
    pendingCount: 0,
    lastError: lastNativeError,
  };

  if (!shouldUseNative()) return base;

  try {
    const plugin = await getNativeNotificationsPlugin();
    base.pluginImported = true;
    try {
      const res = await withTimeout(plugin.checkPermissions(), "status-check");
      base.permission = toPermissionState(res.display);
    } catch (e) {
      captureError("status-check", e);
      base.permission = "default";
    }
    try {
      const pend = await withTimeout(plugin.getPending(), "status-pending");
      base.pendingCount = pend.notifications.length;
    } catch (e) {
      captureError("status-pending", e);
    }
  } catch (e) {
    base.lastError = captureError("status-import", e);
  }
  base.lastError = lastNativeError;
  return base;
}

export type NotificationServiceType = typeof notificationService;
