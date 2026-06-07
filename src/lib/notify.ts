import { toast } from "sonner";
import { useStore, type ScheduledNotif } from "./store";

export function supportsNotifications() {
  return typeof window !== "undefined" && "Notification" in window;
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

export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!supportsNotifications()) {
    log("error", "Permissão", "Navegador não suporta notificações");
    return "unsupported";
  }
  try {
    const result = await Notification.requestPermission();
    log("permission", "Permissão", `Resultado: ${result}`);
    return result;
  } catch (e) {
    log("error", "Permissão", `Falha ao pedir: ${String(e)}`);
    return Notification.permission;
  }
}

/** Show an in-app toast and (when allowed) an OS notification, logging every step. */
export function fireNotification(title: string, body: string) {
  // Always show an in-app toast so feedback works even without OS permission.
  toast(title, { description: body });
  log("sent", title, body);

  if (!supportsNotifications()) {
    log("received", title, "Exibida como aviso no app (sem suporte do navegador)");
    return;
  }
  if (Notification.permission !== "granted") {
    log("received", title, "Exibida como aviso no app (permissão não concedida)");
    return;
  }
  try {
    const n = new Notification(title, {
      body,
      icon: "/icon.svg",
      badge: "/icon.svg",
      tag: title,
      silent: false,
    });
    n.onshow = () => log("received", title, "Notificação exibida pelo sistema");
    n.onerror = () => log("error", title, "Falha ao exibir (onerror)");
    n.onclick = () => {
      window.focus();
      n.close();
    };
    // Fallback confirmation: if onshow never fires we still record delivery attempt.
    setTimeout(() => log("received", title, "Entrega confirmada (timeout)"), 1500);
  } catch (e) {
    log("error", title, `Exceção: ${String(e)}`);
  }
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();

const sUid = () => Math.random().toString(36).slice(2, 10);

/** Schedule a notification after delayMs; tracked so the diagnostics screen can list it. */
export function scheduleNotification(title: string, body: string, delayMs: number): string {
  const id = sUid();
  const sc: ScheduledNotif = { id, fireAt: Date.now() + delayMs, title, body };
  useStore.getState().addScheduled(sc);
  log("scheduled", title, `Em ${Math.round(delayMs / 1000)}s`);
  const t = setTimeout(() => {
    fireNotification(title, body);
    useStore.getState().removeScheduled(id);
    timers.delete(id);
  }, delayMs);
  timers.set(id, t);
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
