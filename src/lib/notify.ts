import { toast } from "sonner";
import { useStore, type ScheduledNotif } from "./store";

const SW_URL = "/notification-sw.js";
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const sUid = () => Math.random().toString(36).slice(2, 10);

let registrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;
let runtimeStarted = false;
let messageBridgeAttached = false;
let catchupAttached = false;
let restoredSchedules = false;

export type NotificationAttemptResult = {
  ok: boolean;
  stage: "unsupported" | "permission" | "service_worker" | "show";
  message: string;
  detail?: string;
};

export type NotificationDiagnosticSnapshot = {
  permission: NotificationPermission | "unsupported";
  notificationApiAvailable: boolean;
  serviceWorkerAvailable: boolean;
  serviceWorkerRegistered: boolean;
  serviceWorkerState: string;
  pushManagerAvailable: boolean;
  pwaStatus: "standalone" | "browser_tab";
  browser: string;
  os: string;
};

export function supportsNotifications() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function supportsServiceWorker() {
  return typeof window !== "undefined" && "serviceWorker" in navigator;
}

export function supportsPushManager() {
  return typeof window !== "undefined" && "PushManager" in window;
}

export function currentPermission(): NotificationPermission | "unsupported" {
  if (!supportsNotifications()) return "unsupported";
  return Notification.permission;
}

function log(kind: Parameters<ReturnType<typeof useStore.getState>["logNotif"]>[0], title: string, detail?: string) {
  try {
    useStore.getState().logNotif(kind, title, detail);
  } catch {
    /* store not ready */
  }
}

function isStandalonePwa() {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return !!window.matchMedia?.("(display-mode: standalone)").matches || nav.standalone === true;
}

function detectBrowser() {
  if (typeof navigator === "undefined") return "Desconhecido";
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return "Microsoft Edge";
  if (/SamsungBrowser\//.test(ua)) return "Samsung Internet";
  if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) return "Google Chrome";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return "Safari";
  return "Desconhecido";
}

function detectOs() {
  if (typeof navigator === "undefined") return "Desconhecido";
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return "Android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Mac OS X/i.test(ua)) return "macOS";
  if (/Linux/i.test(ua)) return "Linux";
  return "Desconhecido";
}

function currentSwState(reg: ServiceWorkerRegistration | null) {
  return reg?.active?.state ?? reg?.waiting?.state ?? reg?.installing?.state ?? "ausente";
}

async function getNotificationRegistration() {
  if (!supportsServiceWorker()) return null;
  try {
    return (await navigator.serviceWorker.getRegistration("/")) ?? (await navigator.serviceWorker.getRegistration());
  } catch {
    return null;
  }
}

async function registerNotificationServiceWorker() {
  if (!supportsServiceWorker()) {
    log("error", "Service Worker", "Service Worker indisponível neste navegador");
    return null;
  }

  if (!registrationPromise) {
    registrationPromise = (async () => {
      try {
        const reg = await navigator.serviceWorker.register(SW_URL, { scope: "/" });
        log("service_worker", "Service Worker", `Registrado com sucesso (${currentSwState(reg)})`);
        return reg;
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        log("error", "Service Worker", `Erro ao registrar: ${detail}`);
        return null;
      }
    })();
  }

  return registrationPromise;
}

function attachMessageBridge() {
  if (!supportsServiceWorker() || messageBridgeAttached) return;
  navigator.serviceWorker.addEventListener("message", (event) => {
    const data = event.data as { source?: string; kind?: string; detail?: string } | undefined;
    if (!data || data.source !== "levelup-notification-sw") return;
    if (data.kind === "active") {
      log("service_worker", "Service Worker", data.detail ?? "Ativo");
      return;
    }
    if (data.kind === "notification-click") {
      log("received", "Notificação", data.detail ?? "Toque detectado");
      return;
    }
    if (data.kind === "notification-close") {
      log("received", "Notificação", data.detail ?? "Fechada pelo usuário");
    }
  });
  messageBridgeAttached = true;
}

async function triggerScheduledNotification(sc: ScheduledNotif, detail = "Timer local disparado") {
  log("triggered", sc.title, detail);
  await fireNotification(sc.title, sc.body, { fallbackToast: false, tag: sc.id, reason: "scheduled" });
  useStore.getState().removeScheduled(sc.id);
  const t = timers.get(sc.id);
  if (t) clearTimeout(t);
  timers.delete(sc.id);
}

async function flushDueScheduledNotifications() {
  const now = Date.now();
  for (const sc of useStore.getState().scheduled) {
    if (sc.fireAt <= now) {
      await triggerScheduledNotification(sc, "Timer recuperado ao voltar para o app");
      continue;
    }
    if (!timers.has(sc.id)) armScheduledNotification(sc);
  }
}

function attachCatchupBridge() {
  if (typeof window === "undefined" || catchupAttached) return;
  const resume = () => {
    void flushDueScheduledNotifications();
  };
  window.addEventListener("focus", resume);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) resume();
  });
  catchupAttached = true;
}

function armScheduledNotification(sc: ScheduledNotif) {
  const existing = timers.get(sc.id);
  if (existing) clearTimeout(existing);
  const delay = Math.max(0, sc.fireAt - Date.now());
  const t = setTimeout(() => {
    void triggerScheduledNotification(sc);
  }, delay);
  timers.set(sc.id, t);
}

async function restoreScheduledNotifications() {
  if (restoredSchedules) return;
  restoredSchedules = true;
  for (const sc of useStore.getState().scheduled) {
    if (sc.fireAt <= Date.now()) {
      await triggerScheduledNotification(sc, "Agendamento vencido recuperado após reabrir o app");
      continue;
    }
    armScheduledNotification(sc);
  }
}

export async function initNotificationRuntime() {
  if (typeof window === "undefined" || runtimeStarted) return;
  runtimeStarted = true;
  attachMessageBridge();
  attachCatchupBridge();
  await registerNotificationServiceWorker();
  await restoreScheduledNotifications();
}

export async function getNotificationDiagnosticSnapshot(): Promise<NotificationDiagnosticSnapshot> {
  const reg = await getNotificationRegistration();
  return {
    permission: currentPermission(),
    notificationApiAvailable: supportsNotifications(),
    serviceWorkerAvailable: supportsServiceWorker(),
    serviceWorkerRegistered: !!reg,
    serviceWorkerState: currentSwState(reg),
    pushManagerAvailable: supportsPushManager(),
    pwaStatus: isStandalonePwa() ? "standalone" : "browser_tab",
    browser: detectBrowser(),
    os: detectOs(),
  };
}

export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!supportsNotifications()) {
    log("error", "Permissão", "Notification API indisponível");
    return "unsupported";
  }
  try {
    log("permission", "Permissão", "Solicitação iniciada");
    const result = await Notification.requestPermission();
    log("permission", "Permissão", `Resultado: ${result}`);
    if (result === "granted") log("permission", "Permissão", "Permissão concedida");
    if (result === "denied") log("error", "Permissão", "Permissão negada");
    if (result === "granted") await registerNotificationServiceWorker();
    return result;
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    log("error", "Permissão", `Falha ao pedir: ${detail}`);
    return Notification.permission;
  }
}

export async function fireNotification(
  title: string,
  body: string,
  options: { fallbackToast?: boolean; tag?: string; reason?: string } = {},
): Promise<NotificationAttemptResult> {
  const { fallbackToast = true, tag, reason } = options;

  if (!supportsNotifications()) {
    if (fallbackToast) toast(title, { description: body });
    log("error", title, "Notification API indisponível");
    return { ok: false, stage: "unsupported", message: "Notification API indisponível" };
  }

  if (Notification.permission !== "granted") {
    if (fallbackToast) toast(title, { description: body });
    log("error", title, "Permissão não concedida");
    return { ok: false, stage: "permission", message: "Permissão não concedida" };
  }

  const reg = await registerNotificationServiceWorker();
  if (!reg) {
    if (fallbackToast) toast(title, { description: body });
    log("error", title, "Service Worker não registrado");
    return { ok: false, stage: "service_worker", message: "Service Worker não registrado" };
  }

  try {
    log("sent", title, reason ? `Solicitada via Service Worker (${reason})` : "Solicitada via Service Worker");
    await reg.showNotification(title, {
      body,
      icon: "/icon.svg",
      badge: "/icon.svg",
      tag: tag ?? title,
      renotify: false,
      silent: false,
      data: { title, body, at: Date.now() },
    });
    log("received", title, "Notificação criada com sucesso");
    return { ok: true, stage: "show", message: "Notificação criada com sucesso" };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    if (fallbackToast) toast(title, { description: body });
    log("error", title, `Erro ao exibir notificação: ${detail}`);
    return { ok: false, stage: "show", message: "Erro ao exibir notificação", detail };
  }
}

/** Schedule a notification after delayMs; tracked so the diagnostics screen can list it. */
export function scheduleNotification(title: string, body: string, delayMs: number): string {
  const id = sUid();
  const sc: ScheduledNotif = { id, fireAt: Date.now() + delayMs, title, body };
  useStore.getState().addScheduled(sc);
  log("scheduled", title, `Agendada para ${Math.round(delayMs / 1000)}s`);
  armScheduledNotification(sc);
  void initNotificationRuntime();
  return id;
}

export function cancelScheduled(id: string) {
  const t = timers.get(id);
  if (t) clearTimeout(t);
  timers.delete(id);
  const sc = useStore.getState().scheduled.find((x) => x.id === id);
  useStore.getState().removeScheduled(id);
  if (sc) log("cancelled", sc.title, "Agendamento cancelado");
}
