import { toast } from "sonner";

export function supportsNotifications() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function currentPermission(): NotificationPermission | "unsupported" {
  if (!supportsNotifications()) return "unsupported";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!supportsNotifications()) return "unsupported";
  try {
    const result = await Notification.requestPermission();
    return result;
  } catch {
    return Notification.permission;
  }
}

export function fireNotification(title: string, body: string) {
  // Always show an in-app toast so feedback works even without OS permission.
  toast(title, { description: body });
  if (supportsNotifications() && Notification.permission === "granted") {
    try {
      const n = new Notification(title, {
        body,
        icon: "/icon.svg",
        tag: title,
        silent: false,
      });
      n.onclick = () => {
        window.focus();
        n.close();
      };
    } catch {
      /* ignore */
    }
  }
}
