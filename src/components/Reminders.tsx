import { useEffect } from "react";
import { useStore, pendingTasks } from "@/lib/store";
import { notificationService } from "@/lib/notification-service";
import { timeToMinutes, nowMinutes } from "@/lib/dates";

const REPEAT_MS = 15 * 60 * 1000; // repeat every 15 min until done
const HOUR = 60 * 60 * 1000;

/** Background watcher: overdue task nudges + anti-procrastination idle alerts. */
export function Reminders() {
  // Anti-procrastination: check idle time once on mount, then mark active.
  useEffect(() => {
    const s = useStore.getState();
    const gap = Date.now() - (s.lastActiveAt || Date.now());
    const thresholds: { ms: number; msg: string }[] = [
      { ms: 72 * HOUR, msg: "72h sem aparecer. Recomeçar é mais fácil do que parece — uma tarefa só." },
      { ms: 48 * HOUR, msg: "48h longe da rotina. Bora retomar com algo pequeno?" },
      { ms: 24 * HOUR, msg: "24h sem usar o LevelUp. Que tal uma vitória rápida agora?" },
    ];
    const hit = thresholds.find((t) => gap >= t.ms);
    if (hit) void notificationService.notify("Sentimos sua falta 👀", hit.msg);
    s.touchActive();
  }, []);

  // Overdue task reminders.
  useEffect(() => {
    function check() {
      const s = useStore.getState();
      const pend = pendingTasks(s.tasks, !!s.badDay);
      const now = nowMinutes();
      const t = Date.now();
      for (const task of pend) {
        if (!task.time) continue;
        if (timeToMinutes(task.time) > now) continue; // not due yet
        const last = s.lastReminderAt[task.id] || 0;
        if (t - last < REPEAT_MS) continue;
        void notificationService.notify("LevelUp — Hora de agir", `${task.name} (${task.time})`);
        s.markReminded(task.id);
        break; // one nudge at a time, stay calm
      }
    }
    check();
    const id = setInterval(check, 60 * 1000);
    return () => clearInterval(id);
  }, []);

  return null;
}
