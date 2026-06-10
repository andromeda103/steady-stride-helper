import { todayKey } from "./dates";
import { isHabitDoneOn } from "./habits";
import type { Cofrinho, Habit, Task, StudyEntry } from "./store";

/** Total study minutes logged on a given day. */
export function studyMinutesOn(studyLog: StudyEntry[], dateKey: string = todayKey()): number {
  const secs = studyLog.filter((e) => e.date === dateKey).reduce((a, e) => a + e.seconds, 0);
  return Math.round(secs / 60);
}

export interface RequirementStatus {
  done: number;
  total: number;
  active: boolean; // está sendo exigido?
  ok: boolean; // cumprido (ou inativo)
}

export interface DayStatus {
  habits: RequirementStatus;
  tasks: RequirementStatus;
  study: RequirementStatus;
  workout: { done: boolean; active: boolean; ok: boolean };
  active: boolean; // existe pelo menos uma exigência configurada
  perfect: boolean; // todas as exigências ativas cumpridas
}

/** Compute today's diagnostic status for the cofrinho reward. */
export function computeDayStatus(
  c: Cofrinho,
  habits: Habit[],
  tasks: Task[],
  studyLog: StudyEntry[],
  workoutLog: string[],
  dateKey: string = todayKey(),
): DayStatus {
  const reqHabits = habits.filter((h) => c.requiredHabitIds.includes(h.id));
  const habitsDone = reqHabits.filter((h) => isHabitDoneOn(h, dateKey)).length;
  const habitsActive = reqHabits.length > 0;
  const habitsOk = !habitsActive || habitsDone === reqHabits.length;

  const reqTaskIds = c.requiredTaskIds ?? [];
  const reqTasks = tasks.filter((t) => reqTaskIds.includes(t.id));
  const tasksDone = reqTasks.filter((t) => t.lastDone === dateKey).length;
  const tasksActive = reqTasks.length > 0;
  const tasksOk = !tasksActive || tasksDone === reqTasks.length;

  const studyTarget = c.minStudyMinutes ?? 0;
  const studyDone = studyMinutesOn(studyLog, dateKey);
  const studyActive = studyTarget > 0;
  const studyOk = !studyActive || studyDone >= studyTarget;

  const workoutDone = workoutLog.includes(dateKey);
  const workoutActive = !!c.requireWorkout;
  const workoutOk = !workoutActive || workoutDone;

  const active = habitsActive || tasksActive || studyActive || workoutActive;
  const perfect = active && habitsOk && tasksOk && studyOk && workoutOk;

  return {
    habits: { done: habitsDone, total: reqHabits.length, active: habitsActive, ok: habitsOk },
    tasks: { done: tasksDone, total: reqTasks.length, active: tasksActive, ok: tasksOk },
    study: { done: studyDone, total: studyTarget, active: studyActive, ok: studyOk },
    workout: { done: workoutDone, active: workoutActive, ok: workoutOk },
    active,
    perfect,
  };
}

/** Longest run of consecutive perfect days. */
export function longestPerfectStreak(perfectDays: string[]): number {
  if (perfectDays.length === 0) return 0;
  const set = new Set(perfectDays);
  let best = 0;
  for (const d of perfectDays) {
    // só conta como início de sequência se o dia anterior não for perfeito
    const prev = new Date(d + "T00:00:00");
    prev.setDate(prev.getDate() - 1);
    const prevKey = prev.toLocaleDateString("en-CA");
    if (set.has(prevKey)) continue;
    let len = 1;
    let cur = new Date(d + "T00:00:00");
    while (true) {
      cur.setDate(cur.getDate() + 1);
      const k = cur.toLocaleDateString("en-CA");
      if (set.has(k)) len++;
      else break;
    }
    best = Math.max(best, len);
  }
  return best;
}

export interface CofrinhoStats {
  totalEarned: number;
  totalSpent: number;
  longestStreak: number;
  earnedThisMonth: number;
}

/** Derive financial statistics from the ledger (single source of truth). */
export function cofrinhoStats(c: Cofrinho): CofrinhoStats {
  const ledger = c.ledger ?? [];
  const month = todayKey().slice(0, 7);
  let totalEarned = 0;
  let totalSpent = 0;
  let earnedThisMonth = 0;
  for (const e of ledger) {
    if (e.amount > 0) {
      totalEarned += e.amount;
      if (e.date.startsWith(month)) earnedThisMonth += e.amount;
    } else {
      totalSpent += -e.amount;
    }
  }
  return {
    totalEarned,
    totalSpent,
    longestStreak: longestPerfectStreak(c.perfectDays),
    earnedThisMonth,
  };
}

export const brl = (n: number) => `R$ ${n.toFixed(2).replace(".", ",")}`;
