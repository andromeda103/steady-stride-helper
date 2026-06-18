// ============================================================================
// task-notifications.ts — REAL feature notifications (tasks + habits).
//
// This module wires the app's actual data (tarefas e hábitos do dia) to the
// native Android scheduler via @capacitor/local-notifications. It reuses the
// SAME proven approach as the working smoke test:
//   - static import of LocalNotifications (SSR-safe: proxy only)
//   - dedicated channel ("levelup_reminders") with importance 5 + vibration
//   - withTimeout(10s) around every native call
//   - permission verified (NEVER requested automatically here)
//
// HARD RULES:
//   - NEVER touch Web Notifications API / Notification / navigator.serviceWorker.
//   - NEVER run on the server (SSR / prerender) — every entry point guards.
//   - NEVER request permission here: it must already be granted on the
//     diagnostics screen. If not granted, we simply do nothing.
// ============================================================================

import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { todayKey } from "./dates";
import type { Task, Habit } from "./store";

const LOG_PREFIX = "[LEVELUP-TASKS]";
const CHANNEL_ID = "levelup_reminders";
const TIMEOUT_MS = 10_000;

// How many 15-minute reminders to schedule after the deadline (8 = 2 hours).
const REMINDER_INTERVAL_MS = 15 * 60 * 1000;
const MAX_REMINDERS = 8;

// Habit reminders use a separate id band so they never collide with tasks.
const HABIT_ID_OFFSET = 500;

// ----------------------------------------------------------------------------
// Guards
// ----------------------------------------------------------------------------

function isServerEnvironment(): boolean {
  return typeof window === "undefined" || Boolean(import.meta.env?.SSR);
}

function isNativeAndroid(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
  } catch {
    return false;
  }
}

/** True only when it is safe to call the native plugin. */
function canRunNative(): boolean {
  return !isServerEnvironment() && isNativeAndroid();
}

// ----------------------------------------------------------------------------
// Timeout wrapper — keep the UI from ever hanging on a native call.
// ----------------------------------------------------------------------------

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

function logError(stage: string, e: unknown): void {
  const err = e instanceof Error ? e : new Error(String(e));
  // eslint-disable-next-line no-console
  console.error(`${LOG_PREFIX} ${stage} FAIL ::`, err.name, err.message, err.stack ?? "");
}

// ----------------------------------------------------------------------------
// Stable numeric ids (LocalNotifications requires integers).
// ----------------------------------------------------------------------------

/**
 * Convert the string task id into a stable positive integer.
 * `offset` 0 = main notification, 1..MAX_REMINDERS = reminder loop.
 */
export function taskIdToNotifId(taskId: string, offset = 0): number {
  let hash = 0;
  for (let i = 0; i < taskId.length; i++) {
    hash = ((hash << 5) - hash + taskId.charCodeAt(i)) | 0;
  }
  return (Math.abs(hash % 900000) + 100000) + offset;
}

/** All ids ever used for a task (main + every reminder slot). */
function allTaskNotifIds(taskId: string): number[] {
  const ids: number[] = [];
  for (let i = 0; i <= MAX_REMINDERS; i++) ids.push(taskIdToNotifId(taskId, i));
  return ids;
}

// ----------------------------------------------------------------------------
// Channel + permission
// ----------------------------------------------------------------------------

let channelReady = false;

async function ensureChannel(): Promise<void> {
  if (channelReady) return;
  await withTimeout(
    LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: "Lembretes LevelUp",
      description: "Lembretes de tarefas e habitos do dia",
      importance: 5,
      visibility: 1,
      vibration: true,
    }),
    "create-channel",
  );
  channelReady = true;
}

/** Read-only permission check. NEVER requests permission. */
async function permissionGranted(): Promise<boolean> {
  try {
    const perm = await withTimeout(LocalNotifications.checkPermissions(), "check-permissions");
    return perm.display === "granted";
  } catch (e) {
    logError("check-permissions", e);
    return false;
  }
}

// ----------------------------------------------------------------------------
// Time helpers
// ----------------------------------------------------------------------------

function isTaskCompleted(task: Task): boolean {
  return task.lastDone === todayKey();
}

/**
 * Build the next firing Date for a HH:MM string. If the time already passed
 * today, schedule for the same time tomorrow.
 */
function nextDateForTime(time: string): Date | null {
  if (!time || !time.includes(":")) return null;
  const [h, m] = time.split(":").map((n) => Number(n));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const now = new Date();
  const target = new Date();
  target.setHours(h, m, 0, 0);
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  return target;
}

// ----------------------------------------------------------------------------
// Public API — tasks
// ----------------------------------------------------------------------------

/**
 * Schedule the main "está no horário" notification for a task, plus the
 * 15-minute reminder loop. Completed tasks (or tasks without a time) schedule
 * nothing and have any pending notifications cancelled.
 */
export async function scheduleTaskNotification(task: Task): Promise<void> {
  if (!canRunNative()) return;
  if (isTaskCompleted(task) || !task.time) {
    await cancelTaskNotifications(task.id);
    return;
  }
  if (!(await permissionGranted())) return;

  const at = nextDateForTime(task.time);
  if (!at) return;

  try {
    await ensureChannel();
    // Replace any previous schedule for this task first.
    await cancelTaskNotifications(task.id);

    await withTimeout(
      LocalNotifications.schedule({
        notifications: [
          {
            id: taskIdToNotifId(task.id, 0),
            title: "LevelUp",
            body: `${task.name} está no horário!`,
            channelId: CHANNEL_ID,
            schedule: { at, allowWhileIdle: true },
            extra: { source: "levelup-task", taskId: task.id, kind: "main" },
          },
        ],
      }),
      "schedule-main",
    );
    await scheduleReminderLoop(task, at);
    // eslint-disable-next-line no-console
    console.log(`${LOG_PREFIX} scheduled "${task.name}" @ ${at.toISOString()}`);
  } catch (e) {
    logError("schedule-task", e);
  }
}

/**
 * Schedule up to MAX_REMINDERS reminders every 15 minutes after the task time.
 * The loop is "best effort": Android delivers them while the task stays
 * pending; cancelTaskNotifications() removes the whole loop once it is done.
 */
export async function scheduleReminderLoop(task: Task, baseAt?: Date): Promise<void> {
  if (!canRunNative()) return;
  if (isTaskCompleted(task) || !task.time) return;
  if (!(await permissionGranted())) return;

  const base = baseAt ?? nextDateForTime(task.time);
  if (!base) return;

  try {
    await ensureChannel();
    const notifications = [];
    for (let i = 1; i <= MAX_REMINDERS; i++) {
      const at = new Date(base.getTime() + i * REMINDER_INTERVAL_MS);
      notifications.push({
        id: taskIdToNotifId(task.id, i),
        title: "LevelUp",
        body: `${task.name} ainda não foi feito.`,
        channelId: CHANNEL_ID,
        schedule: { at, allowWhileIdle: true },
        extra: { source: "levelup-task", taskId: task.id, kind: "reminder", n: i },
      });
    }
    await withTimeout(LocalNotifications.schedule({ notifications }), "schedule-reminders");
  } catch (e) {
    logError("schedule-reminders", e);
  }
}

/** Cancel the main notification AND every reminder slot for a task. */
export async function cancelTaskNotifications(taskId: string): Promise<void> {
  if (!canRunNative()) return;
  try {
    await withTimeout(
      LocalNotifications.cancel({
        notifications: allTaskNotifIds(taskId).map((id) => ({ id })),
      }),
      "cancel-task",
    );
  } catch (e) {
    logError("cancel-task", e);
  }
}

/**
 * Schedule every pending task that has a time. Call on app start and whenever
 * the task list changes. Completed tasks are cancelled.
 */
export async function scheduleAllPendingTasks(tasks: Task[]): Promise<void> {
  if (!canRunNative()) return;
  if (!(await permissionGranted())) return;
  for (const task of tasks) {
    if (isTaskCompleted(task) || !task.time) {
      await cancelTaskNotifications(task.id);
    } else {
      await scheduleTaskNotification(task);
    }
  }
}

// ----------------------------------------------------------------------------
// Public API — habits (daily reminders at each configured time)
// ----------------------------------------------------------------------------

function habitNotifId(habitId: string, index: number): number {
  return taskIdToNotifId(habitId, HABIT_ID_OFFSET + index);
}

/** Schedule a daily-repeating reminder for each configured habit time. */
export async function scheduleHabitNotifications(habits: Habit[]): Promise<void> {
  if (!canRunNative()) return;
  if (!(await permissionGranted())) return;

  try {
    await ensureChannel();
    for (const habit of habits) {
      // Clear previous slots for this habit (cover a generous range of times).
      const stale = Array.from({ length: 12 }, (_, i) => ({ id: habitNotifId(habit.id, i) }));
      await withTimeout(LocalNotifications.cancel({ notifications: stale }), "cancel-habit").catch(() => {});

      if (!habit.times || habit.times.length === 0) continue;

      const notifications = habit.times
        .map((time, i) => {
          if (!time.includes(":")) return null;
          const [h, m] = time.split(":").map((n) => Number(n));
          if (Number.isNaN(h) || Number.isNaN(m)) return null;
          return {
            id: habitNotifId(habit.id, i),
            title: "LevelUp",
            body: `${habit.icon ? habit.icon + " " : ""}${habit.name} — hora do hábito!`,
            channelId: CHANNEL_ID,
            // `on` makes the plugin repeat daily at this hour/minute.
            schedule: { on: { hour: h, minute: m }, allowWhileIdle: true },
            extra: { source: "levelup-habit", habitId: habit.id },
          };
        })
        .filter((n): n is NonNullable<typeof n> => n !== null);

      if (notifications.length > 0) {
        await withTimeout(LocalNotifications.schedule({ notifications }), "schedule-habits");
      }
    }
  } catch (e) {
    logError("schedule-habits", e);
  }
}

// ----------------------------------------------------------------------------
// One-shot sync — reschedules everything from the current store state.
// ----------------------------------------------------------------------------

let syncing = false;

/** Reschedule all task + habit notifications from the latest state (idempotent). */
export async function syncAllNotifications(tasks: Task[], habits: Habit[]): Promise<void> {
  if (!canRunNative() || syncing) return;
  syncing = true;
  try {
    if (!(await permissionGranted())) return;
    await scheduleAllPendingTasks(tasks);
    await scheduleHabitNotifications(habits);
  } finally {
    syncing = false;
  }
}
