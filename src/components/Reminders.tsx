import { useEffect } from "react";
import { useStore, pendingTasks } from "@/lib/store";
import { fireNotification } from "@/lib/notify";
import { timeToMinutes, nowMinutes } from "@/lib/dates";

const REPEAT_MS = 15 * 60 * 1000; // repeat every 15 min until done

/** Background watcher: notifies when a task is overdue and repeats until completed. */
export function Reminders() {
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
        fireNotification("LevelUp — Hora de agir", `${task.name} (${task.time})`);
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
