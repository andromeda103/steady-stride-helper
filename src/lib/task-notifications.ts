// ============================================================================
// task-notifications.ts — REAL feature notifications (tasks + habits).
//
// Wires the app's actual data (tarefas e hábitos do dia) to the native Android
// scheduler via @capacitor/local-notifications. Reuses the SAME proven approach
// as the working smoke test:
//   - static import of LocalNotifications (SSR-safe: proxy only)
//   - dedicated channel ("levelup_tasks") with importance 5 + vibration
//   - withTimeout(10s) around every native call
//   - permission verified (NEVER requested automatically here)
//
// Per-task reminder configuration (TaskReminderSettings) controls:
//   - beforeMinutes: an early "próxima tarefa" warning
//   - notifyAtTime: the "hora da tarefa" notification
//   - repeatIfPending + repeatIntervalMinutes (5 or 10) + maxRepeatCount /
//     stopAfterMinutes: individual "tarefa pendente" reminders, each scheduled
//     as its own notification with its own stable id (NEVER schedule.every).
//
// HARD RULES:
//   - NEVER touch Web Notifications API / Notification / navigator.serviceWorker.
//   - NEVER run on the server (SSR / prerender) — every entry point guards.
//   - NEVER request permission here: it must already be granted on the
//     diagnostics screen. If not granted, we simply do nothing.
//   - NEVER schedule a notification in the past.
// ============================================================================

import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { todayKey, addDaysKey } from "./dates";
import {
  DEFAULT_TASK_REMINDER_SETTINGS,
  type Task,
  type Habit,
  type TaskReminderSettings,
} from "./store";

const LOG_PREFIX = "[LEVELUP-TASKS]";
const CHANNEL_ID = "levelup_tasks";
const TIMEOUT_MS = 10_000;

// How many days ahead daily occurrences are scheduled. Reconciliation runs on
// app start / store changes, so a small window is enough and avoids flooding.
const TASK_NOTIFICATION_HORIZON_DAYS = 2;

// Habit reminders use a separate id band so they never collide with tasks.
const HABIT_ID_OFFSET = 90;

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
// Stable numeric ids (LocalNotifications requires positive 31-bit integers).
//
//   id = (hash(taskId + ":" + dateKey) % 1_000_000) * 100 + slot
//
// slot bands per occurrence:
//   1        -> "before" early warning
//   2        -> "at-time"
//   10..89   -> repeat reminders (index 0..)
// Max value ~99,999,999 < 2^31, stable across restarts, collision-safe.
// ----------------------------------------------------------------------------

function hashString(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % 1_000_000;
}

type ReminderKind = "before" | "at-time" | "repeat";

function slotFor(kind: ReminderKind, repeatIndex = 0): number {
  if (kind === "before") return 1;
  if (kind === "at-time") return 2;
  return 10 + repeatIndex; // repeats
}

export function createTaskNotificationId(params: {
  taskId: string;
  occurrenceDate: string;
  kind: ReminderKind;
  repeatIndex?: number;
}): number {
  const base = hashString(`${params.taskId}:${params.occurrenceDate}`);
  return base * 100 + slotFor(params.kind, params.repeatIndex ?? 0);
}

/** Every native id ever used for a single (task, date) occurrence. */
function allOccurrenceIds(taskId: string, occurrenceDate: string): number[] {
  const ids: number[] = [
    createTaskNotificationId({ taskId, occurrenceDate, kind: "before" }),
    createTaskNotificationId({ taskId, occurrenceDate, kind: "at-time" }),
  ];
  // Cover a generous repeat range (0..49) so edits with fewer repeats still clean up.
  for (let i = 0; i < 50; i++) {
    ids.push(createTaskNotificationId({ taskId, occurrenceDate, kind: "repeat", repeatIndex: i }));
  }
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
      name: "Tarefas e hábitos",
      description: "Lembretes de tarefas, hábitos, estudos e rotina",
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
// Settings + time helpers
// ----------------------------------------------------------------------------

function effectiveReminder(task: Task): TaskReminderSettings {
  return { ...DEFAULT_TASK_REMINDER_SETTINGS, ...task.reminderSettings };
}

function isTaskCompletedOn(task: Task, dateKey: string): boolean {
  return task.lastDone === dateKey;
}

/** Build a Date for a HH:MM string on a specific date key. Null if invalid. */
function dateForTimeOn(dateKey: string, time: string): Date | null {
  if (!time || !time.includes(":")) return null;
  const [h, m] = time.split(":").map((n) => Number(n));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const d = new Date(`${dateKey}T00:00:00`);
  d.setHours(h, m, 0, 0);
  return d;
}

interface PlannedNotification {
  id: number;
  at: Date;
  kind: ReminderKind;
  repeatIndex: number;
  isLast: boolean;
}

/**
 * Compute every reminder Date for one task occurrence, honoring its settings
 * and dropping anything already in the past. Individual notifications only —
 * never `schedule.every`.
 */
function planOccurrence(task: Task, dateKey: string, now: number): PlannedNotification[] {
  const settings = effectiveReminder(task);
  if (!settings.enabled || !task.time) return [];

  const base = dateForTimeOn(dateKey, task.time);
  if (!base) return [];

  const plan: PlannedNotification[] = [];

  // 1. Early warning (skip if its moment already passed).
  if (settings.beforeMinutes > 0) {
    const at = new Date(base.getTime() - settings.beforeMinutes * 60_000);
    if (at.getTime() > now) {
      plan.push({
        id: createTaskNotificationId({ taskId: task.id, occurrenceDate: dateKey, kind: "before" }),
        at,
        kind: "before",
        repeatIndex: 0,
        isLast: false,
      });
    }
  }

  // 2. At-time.
  if (settings.notifyAtTime && base.getTime() > now) {
    plan.push({
      id: createTaskNotificationId({ taskId: task.id, occurrenceDate: dateKey, kind: "at-time" }),
      at: new Date(base.getTime()),
      kind: "at-time",
      repeatIndex: 0,
      isLast: false,
    });
  }

  // 3. Repeats — individual slots every `repeatIntervalMinutes`, capped by
  //    maxRepeatCount AND stopAfterMinutes.
  if (settings.repeatIfPending && settings.maxRepeatCount > 0) {
    const interval = settings.repeatIntervalMinutes;
    const maxByCount = settings.maxRepeatCount;
    const maxByDuration = settings.stopAfterMinutes
      ? Math.floor(settings.stopAfterMinutes / interval)
      : Number.POSITIVE_INFINITY;
    const total = Math.max(0, Math.min(maxByCount, maxByDuration));

    for (let i = 1; i <= total; i++) {
      const at = new Date(base.getTime() + i * interval * 60_000);
      if (at.getTime() <= now) continue; // never schedule in the past
      plan.push({
        id: createTaskNotificationId({
          taskId: task.id,
          occurrenceDate: dateKey,
          kind: "repeat",
          repeatIndex: i - 1,
        }),
        at,
        kind: "repeat",
        repeatIndex: i - 1,
        isLast: i === total,
      });
    }
  }

  return plan;
}

// ----------------------------------------------------------------------------
// Notification copy (gentle, never guilt-tripping)
// ----------------------------------------------------------------------------

function textFor(task: Task, p: PlannedNotification): { title: string; body: string } {
  const before = effectiveReminder(task).beforeMinutes;
  switch (p.kind) {
    case "before":
      return { title: "LevelUp — Próxima tarefa", body: `Em ${before} minutos: ${task.name}` };
    case "at-time":
      return { title: "LevelUp — Hora da tarefa", body: `Agora: ${task.name}` };
    case "repeat":
    default:
      return p.isLast
        ? { title: "LevelUp — Último lembrete", body: `${task.name} continua pendente.` }
        : { title: "LevelUp — Tarefa pendente", body: `Você ainda não concluiu: ${task.name}` };
  }
}

// ----------------------------------------------------------------------------
// Occurrence scheduling
// ----------------------------------------------------------------------------

/** Cancel every native id associated with one task occurrence (precise). */
export async function cancelTaskOccurrenceNotifications(taskId: string, occurrenceDate: string): Promise<void> {
  if (!canRunNative()) return;
  try {
    await withTimeout(
      LocalNotifications.cancel({
        notifications: allOccurrenceIds(taskId, occurrenceDate).map((id) => ({ id })),
      }),
      "cancel-occurrence",
    );
  } catch (e) {
    logError("cancel-occurrence", e);
  }
}

/** Cancel all known occurrences (today + horizon) for a task series. */
export async function cancelTaskSeriesNotifications(taskId: string): Promise<void> {
  if (!canRunNative()) return;
  const today = todayKey();
  for (let d = 0; d < TASK_NOTIFICATION_HORIZON_DAYS; d++) {
    await cancelTaskOccurrenceNotifications(taskId, addDaysKey(today, d));
  }
}

/**
 * Schedule (or clear) the notifications for a single task occurrence. Completed
 * occurrences cancel everything; pending ones replace any previous schedule.
 */
export async function scheduleTaskOccurrenceNotifications(task: Task, occurrenceDate: string): Promise<void> {
  if (!canRunNative()) return;

  // Always cancel the previous schedule for this exact occurrence first.
  await cancelTaskOccurrenceNotifications(task.id, occurrenceDate);

  if (isTaskCompletedOn(task, occurrenceDate)) return;

  const plan = planOccurrence(task, occurrenceDate, Date.now());
  if (plan.length === 0) return;

  if (!(await permissionGranted())) return;

  try {
    await ensureChannel();
    const notifications = plan.map((p) => {
      const { title, body } = textFor(task, p);
      return {
        id: p.id,
        title,
        body,
        channelId: CHANNEL_ID,
        schedule: { at: p.at, allowWhileIdle: true },
        autoCancel: true,
        extra: {
          source: "task-reminder",
          taskId: task.id,
          occurrenceKey: `${task.id}:${occurrenceDate}`,
          occurrenceDate,
          reminderKind: p.kind,
          repeatIndex: p.repeatIndex,
        },
      };
    });
    await withTimeout(LocalNotifications.schedule({ notifications }), "schedule-occurrence");
    // eslint-disable-next-line no-console
    console.log(`${LOG_PREFIX} scheduled "${task.name}" ${occurrenceDate}: ${notifications.length} reminders`);
  } catch (e) {
    logError("schedule-occurrence", e);
  }
}

/** Reschedule one task across the whole horizon (edit-safe). */
export async function rescheduleTaskOccurrenceNotifications(task: Task): Promise<void> {
  if (!canRunNative()) return;
  const today = todayKey();
  for (let d = 0; d < TASK_NOTIFICATION_HORIZON_DAYS; d++) {
    await scheduleTaskOccurrenceNotifications(task, addDaysKey(today, d));
  }
}

/** Schedule every task across the horizon. Completed/timeless tasks are cleared. */
export async function scheduleAllPendingTasks(tasks: Task[]): Promise<void> {
  if (!canRunNative()) return;
  if (!(await permissionGranted())) return;
  for (const task of tasks) {
    await rescheduleTaskOccurrenceNotifications(task);
  }
}

// ----------------------------------------------------------------------------
// Habits (daily-repeating reminders at each configured time)
// ----------------------------------------------------------------------------

function habitNotifId(habitId: string, index: number): number {
  return hashString(`habit:${habitId}`) * 100 + (HABIT_ID_OFFSET + index);
}

export async function scheduleHabitNotifications(habits: Habit[]): Promise<void> {
  if (!canRunNative()) return;
  if (!(await permissionGranted())) return;

  try {
    await ensureChannel();
    for (const habit of habits) {
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
            title: "LevelUp — Hábito",
            body: `${habit.icon ? habit.icon + " " : ""}${habit.name} — hora do hábito!`,
            channelId: CHANNEL_ID,
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
// One-shot sync / reconciliation — reschedules everything from current state.
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

/** List native ids currently accepted by the OS (diagnostics). */
export async function getTaskPendingNotificationIds(): Promise<number[]> {
  if (!canRunNative()) return [];
  try {
    const pend = await withTimeout(LocalNotifications.getPending(), "get-pending");
    return pend.notifications.map((n) => n.id);
  } catch (e) {
    logError("get-pending", e);
    return [];
  }
}
