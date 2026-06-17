// ============================================================================
// native-notify-smoke.ts
//
// SELF-CONTAINED native Android notification smoke test.
//
// This module is intentionally INDEPENDENT from the rest of the app:
//   - No Zustand store
//   - No Supabase
//   - No routine / habits / tasks
//   - No Service Worker / web Notification API / web fallback
//   - No recurrence / exact-alarm / boot-receiver logic
//
// Its single goal: make ONE real native notification appear in the APK and
// produce a verifiable, structured diagnostic report.
//
// ROOT-CAUSE NOTE:
//   The previous flow gated EVERYTHING behind
//   `Capacitor.isPluginAvailable("LocalNotifications")`. When that returned
//   false (timing / bridge edge cases), the code silently fell back to the
//   web path and NEVER attempted to import or call the plugin — so no native
//   notification could ever fire. Here, `isPluginAvailable()` is reported as
//   DIAGNOSTIC ONLY. As long as `Capacitor.isNativePlatform() === true` and
//   `Capacitor.getPlatform() === "android"`, we import and call the plugin
//   directly and surface the REAL error if anything fails.
// ============================================================================

import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

// ----------------------------------------------------------------------------
// STATIC, ALWAYS-VISIBLE build identification (bundled into the APK).
// These constants are literals — never computed with new Date() at runtime —
// so the value stays glued to the exact code shipped in the build.
// ----------------------------------------------------------------------------
export const NOTIFICATION_DIAGNOSTIC_VERSION = "native-v10-immediate";
export const NOTIFICATION_DIAGNOSTIC_BUILD = "2026-06-17 14:30 BRT";

const LOG_PREFIX = "[LEVELUP-NOTIFY]";
const TEST_CHANNEL_ID = "levelup_native_test";

// Fixed notification ids (never Date.now()).
export const SMOKE_TEST_ID = 10001;
export const SMOKE_TEST_ID_10S = 10002;
export const SMOKE_TEST_ID_60S = 10003;

// ----------------------------------------------------------------------------
// Structured logging
// ----------------------------------------------------------------------------

export interface SmokeLogEntry {
  timestamp: string;
  stage: string;
  success: boolean;
  message: string;
  data?: unknown;
}

let smokeLog: SmokeLogEntry[] = [];

export function getSmokeLog(): SmokeLogEntry[] {
  return smokeLog;
}

export function clearSmokeLog(): void {
  smokeLog = [];
}

function pushLog(stage: string, success: boolean, message: string, data?: unknown): SmokeLogEntry {
  const entry: SmokeLogEntry = {
    timestamp: new Date().toISOString(),
    stage,
    success,
    message,
    data,
  };
  smokeLog = [entry, ...smokeLog].slice(0, 120);
  // Real console output (never a silent catch).
  // eslint-disable-next-line no-console
  console.log(`${LOG_PREFIX} ${stage} ${success ? "OK" : "FAIL"} :: ${message}`, data ?? "");
  return entry;
}

export interface SerializedError {
  name: string;
  message: string;
  stack?: string;
  cause?: string;
  stage?: string;
}

function serializeError(e: unknown, stage?: string): SerializedError {
  if (e instanceof Error) {
    return {
      name: e.name,
      message: e.message,
      stack: e.stack,
      cause: e.cause ? String(e.cause) : undefined,
      stage,
    };
  }
  return { name: "UnknownError", message: String(e), stage };
}

// ----------------------------------------------------------------------------
// Timeout helper — every native call is wrapped so the UI never hangs.
// ----------------------------------------------------------------------------

export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, stage: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Operação nativa não respondeu em ${Math.round(timeoutMs / 1000)} segundos (etapa: ${stage})`));
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const TIMEOUT_MS = 10_000;

// ----------------------------------------------------------------------------
// Plugin typing (minimal, only what we use)
// ----------------------------------------------------------------------------

type PermStatus = { display: "granted" | "denied" | "prompt" | "prompt-with-rationale" | string };

type LocalNotificationsPlugin = {
  checkPermissions: () => Promise<PermStatus>;
  requestPermissions: () => Promise<PermStatus>;
  createChannel: (opts: {
    id: string;
    name: string;
    description?: string;
    importance?: number;
    visibility?: number;
    vibration?: boolean;
  }) => Promise<void>;
  schedule: (opts: {
    notifications: Array<{
      id: number;
      title: string;
      body: string;
      channelId?: string;
      schedule?: { at: Date };
      extra?: Record<string, unknown>;
    }>;
  }) => Promise<void>;
  cancel: (opts: { notifications: Array<{ id: number }> }) => Promise<void>;
  getPending: () => Promise<{ notifications: Array<{ id: number }> }>;
  addListener: (event: string, cb: (data: unknown) => void) => Promise<unknown> | unknown;
};

// ----------------------------------------------------------------------------
// Environment diagnostics (official Capacitor API only)
// ----------------------------------------------------------------------------

export interface EnvDiagnostics {
  native: boolean;
  platform: string;
  pluginReportedAvailable: boolean;
}

export function readEnvDiagnostics(): EnvDiagnostics {
  let native = false;
  let platform = "web";
  let pluginReportedAvailable = false;
  try {
    native = Capacitor.isNativePlatform();
  } catch {
    /* ignore */
  }
  try {
    platform = Capacitor.getPlatform();
  } catch {
    /* ignore */
  }
  try {
    pluginReportedAvailable = Capacitor.isPluginAvailable("LocalNotifications");
  } catch {
    /* ignore */
  }
  return { native, platform, pluginReportedAvailable };
}

// ----------------------------------------------------------------------------
// Plugin import — attempted DIRECTLY (not gated by isPluginAvailable).
// ----------------------------------------------------------------------------

/** SSR / prerender guard — true means it is NOT safe to touch the plugin. */
export function isServerEnvironment(): boolean {
  return typeof window === "undefined" || Boolean(import.meta.env?.SSR);
}

async function importPlugin(): Promise<LocalNotificationsPlugin> {
  // The static import is bundled; we just confirm the export is present.
  // No native method is ever called at module scope — only here, on demand.
  const plugin = LocalNotifications as unknown as LocalNotificationsPlugin | undefined;
  if (!plugin) {
    throw new Error("LocalNotifications está ausente no export do plugin.");
  }
  pushLog("plugin-import", true, "Plugin LocalNotifications disponível (import estático).");
  return plugin;
}

// ----------------------------------------------------------------------------
// Listeners — registered exactly once.
// ----------------------------------------------------------------------------

let notificationListenersInitialized = false;

export interface ListenerEvent {
  id?: number;
  title?: string;
  body?: string;
  at: string;
  extra?: unknown;
  actionId?: string;
}

let lastReceived: ListenerEvent | null = null;
let lastAction: ListenerEvent | null = null;

export function getLastReceived(): ListenerEvent | null {
  return lastReceived;
}
export function getLastAction(): ListenerEvent | null {
  return lastAction;
}

async function ensureListeners(plugin: LocalNotificationsPlugin): Promise<void> {
  if (notificationListenersInitialized) return;
  notificationListenersInitialized = true;
  try {
    await plugin.addListener("localNotificationReceived", (data: unknown) => {
      const n = data as { id?: number; title?: string; body?: string; extra?: unknown } | undefined;
      lastReceived = {
        id: n?.id,
        title: n?.title,
        body: n?.body,
        at: new Date().toISOString(),
        extra: n?.extra,
      };
      pushLog("received", true, n?.title ?? "Notificação recebida", lastReceived);
    });
    await plugin.addListener("localNotificationActionPerformed", (data: unknown) => {
      const a = data as { actionId?: string; notification?: { id?: number; title?: string; extra?: unknown } } | undefined;
      lastAction = {
        id: a?.notification?.id,
        title: a?.notification?.title,
        at: new Date().toISOString(),
        extra: a?.notification?.extra,
        actionId: a?.actionId,
      };
      pushLog("action", true, a?.notification?.title ?? "Ação na notificação", lastAction);
    });
    pushLog("listeners", true, "Listeners nativos registrados (uma vez).");
  } catch (e) {
    pushLog("listeners", false, "Falha ao registrar listeners", serializeError(e, "listeners"));
  }
}

// ----------------------------------------------------------------------------
// Permission flow — native plugin only, NEVER Notification.requestPermission().
// ----------------------------------------------------------------------------

export interface PermissionFlowResult {
  native: boolean;
  platform: string;
  before: string | null;
  requested: string | null;
  after: string | null;
  granted: boolean;
  error: SerializedError | null;
}

export async function requestNativePermission(): Promise<PermissionFlowResult> {
  const env = readEnvDiagnostics();
  const result: PermissionFlowResult = {
    native: env.native,
    platform: env.platform,
    before: null,
    requested: null,
    after: null,
    granted: false,
    error: null,
  };
  pushLog("permission-flow", true, "Início do fluxo de permissão", env);

  if (isServerEnvironment()) {
    result.error = serializeError(
      new Error("Permissão nativa bloqueada no ambiente SSR / prerenderização."),
      "server-environment-blocked",
    );
    pushLog("server-environment-blocked", false, result.error.message);
    return result;
  }


  if (!env.native || env.platform !== "android") {
    result.error = serializeError(
      new Error("Ambiente não-nativo: permissão nativa só existe no APK Android."),
      "permission-flow",
    );
    pushLog("permission-flow", false, result.error.message);
    return result;
  }

  try {
    const plugin = await importPlugin();

    const before = await withTimeout(plugin.checkPermissions(), TIMEOUT_MS, "permission-before");
    result.before = before.display;
    pushLog("permission-before", true, before.display, before);

    if (before.display !== "granted") {
      const requested = await withTimeout(plugin.requestPermissions(), TIMEOUT_MS, "permission-request");
      result.requested = requested.display;
      pushLog("permission-request", true, requested.display, requested);
    }

    const after = await withTimeout(plugin.checkPermissions(), TIMEOUT_MS, "permission-after");
    result.after = after.display;
    result.granted = after.display === "granted";
    pushLog("permission-after", result.granted, after.display, after);
  } catch (e) {
    result.error = serializeError(e, "permission-flow");
    pushLog("error", false, result.error.message, result.error);
  }
  return result;
}

// ----------------------------------------------------------------------------
// Core smoke test
// ----------------------------------------------------------------------------

export interface SmokeReport {
  version: string;
  diagnosticVersion: string;
  diagnosticBuild: string;
  clickCaptured: true;
  serverBlocked: boolean;
  native: boolean;
  platform: string;
  pluginReportedAvailable: boolean;
  pluginImported: boolean;
  permissionBefore: string | null;
  permissionRequested: string | null;
  permissionAfter: string | null;
  channelCreated: boolean;
  scheduleResolved: boolean;
  notificationId: number;
  scheduledAt: string | null;
  pendingIds: number[];
  foundInPending: boolean;
  error: SerializedError | null;
  log: SmokeLogEntry[];
}

async function runCoreSmoke(notificationId: number, delayMs: number): Promise<SmokeReport> {
  const env = readEnvDiagnostics();
  const report: SmokeReport = {
    version: NOTIFICATION_DIAGNOSTIC_VERSION,
    diagnosticVersion: NOTIFICATION_DIAGNOSTIC_VERSION,
    diagnosticBuild: NOTIFICATION_DIAGNOSTIC_BUILD,
    clickCaptured: true,
    serverBlocked: false,
    native: env.native,
    platform: env.platform,
    pluginReportedAvailable: env.pluginReportedAvailable,
    pluginImported: false,
    permissionBefore: null,
    permissionRequested: null,
    permissionAfter: null,
    channelCreated: false,
    scheduleResolved: false,
    notificationId,
    scheduledAt: null,
    pendingIds: [],
    foundInPending: false,
    error: null,
    log: [],
  };

  // SSR / prerender guard — never touch the plugin off the device WebView.
  if (isServerEnvironment()) {
    report.serverBlocked = true;
    report.error = serializeError(
      new Error("Execução do plugin bloqueada no ambiente SSR / prerenderização."),
      "server-environment-blocked",
    );
    pushLog("server-environment-blocked", false, report.error.message);
    report.log = getSmokeLog();
    return report;
  }


  pushLog("click", true, `Smoke test iniciado (id=${notificationId}, +${Math.round(delayMs / 1000)}s)`, env);
  pushLog("platform", true, `native=${env.native} platform=${env.platform} pluginAvailable=${env.pluginReportedAvailable}`);

  if (!env.native || env.platform !== "android") {
    report.error = serializeError(
      new Error("Ambiente não-nativo: a notificação nativa só aparece no APK Android (Capacitor)."),
      "preflight",
    );
    pushLog("error", false, report.error.message);
    report.log = getSmokeLog();
    return report;
  }

  try {
    // 1. Import the plugin DIRECTLY (not blocked by isPluginAvailable).
    const plugin = await importPlugin();
    report.pluginImported = true;

    // 2. Permission: check -> request (if needed) -> check.
    const before = await withTimeout(plugin.checkPermissions(), TIMEOUT_MS, "permission-before");
    report.permissionBefore = before.display;
    pushLog("permission-before", true, before.display, before);

    if (before.display !== "granted") {
      const requested = await withTimeout(plugin.requestPermissions(), TIMEOUT_MS, "permission-request");
      report.permissionRequested = requested.display;
      pushLog("permission-request", true, requested.display, requested);
    }

    const after = await withTimeout(plugin.checkPermissions(), TIMEOUT_MS, "permission-after");
    report.permissionAfter = after.display;
    pushLog("permission-after", after.display === "granted", after.display, after);

    if (after.display !== "granted") {
      throw new Error(`Permissão de notificações não concedida: ${after.display}`);
    }

    // 3. Channel (Android 8+ requirement). No exact-alarm dependency.
    await withTimeout(
      plugin.createChannel({
        id: TEST_CHANNEL_ID,
        name: "Teste nativo LevelUp",
        description: "Canal para validar notificações nativas",
        importance: 5,
        visibility: 1,
        vibration: true,
      }),
      TIMEOUT_MS,
      "channel-create",
    );
    report.channelCreated = true;
    pushLog("channel-create", true, `Canal "${TEST_CHANNEL_ID}" criado/garantido`);

    // 4. Register listeners once.
    await ensureListeners(plugin);

    // 5. Cancel ONLY the previous instance of this exact test id.
    await withTimeout(plugin.cancel({ notifications: [{ id: notificationId }] }), TIMEOUT_MS, "cancel").catch(() => {
      /* nothing pending — fine */
    });

    // 6. Schedule (no allowWhileIdle, no exact alarm for the basic test).
    const scheduledAt = new Date(Date.now() + delayMs);
    report.scheduledAt = scheduledAt.toISOString();
    await withTimeout(
      plugin.schedule({
        notifications: [
          {
            id: notificationId,
            title: "LevelUp",
            body: "A notificação nativa está funcionando.",
            channelId: TEST_CHANNEL_ID,
            schedule: { at: scheduledAt },
            extra: { source: "levelup-native-smoke-test", id: notificationId },
          },
        ],
      }),
      TIMEOUT_MS,
      "schedule",
    );
    report.scheduleResolved = true;
    pushLog("schedule", true, `schedule() resolvido — dispara em ${Math.round(delayMs / 1000)}s`, { notificationId, scheduledAt: report.scheduledAt });

    // 7. getPending() — proof that the OS accepted the schedule.
    const pending = await withTimeout(plugin.getPending(), TIMEOUT_MS, "pending");
    report.pendingIds = pending.notifications.map((n) => n.id);
    report.foundInPending = report.pendingIds.includes(notificationId);
    pushLog(
      "pending",
      report.foundInPending,
      report.foundInPending
        ? `ID ${notificationId} encontrado em getPending()`
        : `ID ${notificationId} NÃO encontrado em getPending()`,
      report.pendingIds,
    );
  } catch (e) {
    report.error = serializeError(e, "smoke");
    pushLog("error", false, report.error.message, report.error);
  }

  report.log = getSmokeLog();
  return report;
}

/** Basic smoke test — fixed ID 10001, fires ~5s later. */
export function runNativeNotificationSmokeTest(): Promise<SmokeReport> {
  return runCoreSmoke(SMOKE_TEST_ID, 5000);
}

/** 10-second scheduled test — fixed ID 10002. */
export function runNativeTest10s(): Promise<SmokeReport> {
  return runCoreSmoke(SMOKE_TEST_ID_10S, 10_000);
}

/** 1-minute scheduled test — fixed ID 10003. */
export function runNativeTest60s(): Promise<SmokeReport> {
  return runCoreSmoke(SMOKE_TEST_ID_60S, 60_000);
}
