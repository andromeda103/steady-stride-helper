import type { WeeklyMission } from "./store";
import { daysUntil, addDaysKey } from "./dates";

export interface MissionInfo {
  pct: number;
  daysLeft: number;
  daysLeftLabel: string;
  deadline: string;
  deadlineLabel: string;
  overdue: boolean;
  done: boolean;
}

/** Fallback deadline for older missions without an explicit one (end of their week). */
function resolveDeadline(m: WeeklyMission): string {
  if (m.deadline) return m.deadline;
  return addDaysKey(m.weekStart, 6);
}

/** Compute progress, percentage, deadline and days remaining for a main mission. */
export function missionInfo(m: WeeklyMission): MissionInfo {
  const pct = Math.min(100, Math.round((m.current / m.target) * 100));
  const deadline = resolveDeadline(m);
  const daysLeft = daysUntil(deadline);
  const done = pct >= 100;
  const overdue = !done && daysLeft < 0;

  const d = new Date(deadline + "T00:00:00");
  const deadlineLabel = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

  let daysLeftLabel: string;
  if (done) daysLeftLabel = "Concluída ✓";
  else if (daysLeft < 0) daysLeftLabel = "Prazo vencido";
  else if (daysLeft === 0) daysLeftLabel = "Último dia";
  else if (daysLeft === 1) daysLeftLabel = "1 dia";
  else daysLeftLabel = `${daysLeft} dias`;

  return { pct, daysLeft, daysLeftLabel, deadline, deadlineLabel, overdue, done };
}
