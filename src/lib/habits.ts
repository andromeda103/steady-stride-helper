import { todayKey, addDaysKey } from "./dates";
import type { Habit, HabitMode, Category } from "./store";

/** Progress logged for a habit on a given day (count or minutes). */
export function habitProgress(h: Habit, dateKey: string = todayKey()): number {
  return h.logByDay?.[dateKey] ?? 0;
}

/** Whether the daily goal was reached on a given day. */
export function isHabitDoneOn(h: Habit, dateKey: string = todayKey()): boolean {
  return h.target > 0 && habitProgress(h, dateKey) >= h.target;
}

/** Completion percentage (0-100, capped) for a given day. */
export function habitPct(h: Habit, dateKey: string = todayKey()): number {
  if (h.target <= 0) return 0;
  return Math.min(100, Math.round((habitProgress(h, dateKey) / h.target) * 100));
}

/** Human label e.g. "2/3" or "180/240 min". */
export function formatHabitProgress(h: Habit, dateKey: string = todayKey()): string {
  const p = habitProgress(h, dateKey);
  return h.mode === "time" ? `${p}/${h.target} min` : `${p}/${h.target}`;
}

/** Suggested step for the quick +/- buttons based on goal size. */
export function habitStep(h: Habit): number {
  if (h.mode === "time") return 5;
  if (h.target >= 50) return 10;
  if (h.target >= 20) return 5;
  return 1;
}

export interface HabitStats {
  streak: number; // dias consecutivos com meta atingida (até hoje/ontem)
  weeklyAvgPct: number; // média de conclusão nos últimos 7 dias
  monthlyAvgPct: number; // média de conclusão nos últimos 30 dias
  completionRate: number; // % de dias com meta atingida nos últimos 30 dias
}

export function habitStats(h: Habit): HabitStats {
  // streak: conta para trás a partir de hoje; se hoje ainda não concluído, começa ontem.
  let streak = 0;
  let key = todayKey();
  if (!isHabitDoneOn(h, key)) key = addDaysKey(key, -1);
  while (isHabitDoneOn(h, key)) {
    streak++;
    key = addDaysKey(key, -1);
  }

  const avgPct = (days: number) => {
    let sum = 0;
    for (let i = 0; i < days; i++) sum += habitPct(h, addDaysKey(todayKey(), -i));
    return Math.round(sum / days);
  };

  let doneDays = 0;
  for (let i = 0; i < 30; i++) {
    if (isHabitDoneOn(h, addDaysKey(todayKey(), -i))) doneDays++;
  }

  return {
    streak,
    weeklyAvgPct: avgPct(7),
    monthlyAvgPct: avgPct(30),
    completionRate: Math.round((doneDays / 30) * 100),
  };
}

// ---------------------------------------------------------------------------
// Quick templates
// ---------------------------------------------------------------------------

export type HabitTemplateItem = Omit<Habit, "id" | "logByDay" | "lastDone">;

export interface HabitTemplate {
  id: string;
  name: string;
  icon: string;
  desc: string;
  items: HabitTemplateItem[];
}

const item = (
  name: string,
  icon: string,
  category: Category,
  mode: HabitMode,
  target: number,
  times: string[] = [],
  pomodoroLinked = false,
): HabitTemplateItem => ({ name, icon, category, mode, target, times, pomodoroLinked });

export const HABIT_TEMPLATES: HabitTemplate[] = [
  {
    id: "concurso",
    name: "Concurso",
    icon: "📚",
    desc: "Estudo, questões e revisão",
    items: [
      item("Estudar", "📚", "Estudos", "time", 240, [], true),
      item("Ciclos de Pomodoro", "🍅", "Estudos", "count", 4),
      item("Resolver questões", "✍️", "Estudos", "count", 100),
      item("Revisar conteúdo", "🔁", "Estudos", "count", 1, ["20:00"]),
    ],
  },
  {
    id: "academia",
    name: "Academia",
    icon: "💪",
    desc: "Treino, creatina e proteína",
    items: [
      item("Treinar", "🏋️", "Treino", "time", 60, ["18:00"]),
      item("Tomar creatina", "💊", "Treino", "count", 1, ["12:00"]),
      item("Bater proteína", "🥩", "Dieta", "count", 1),
      item("Alongar", "🧘", "Treino", "count", 1, ["07:00"]),
    ],
  },
  {
    id: "saude",
    name: "Saúde",
    icon: "❤️",
    desc: "Água, sono e movimento",
    items: [
      item("Beber água", "💧", "Saúde", "count", 8),
      item("Caminhar", "🚶", "Saúde", "time", 20),
      item("Dormir no horário", "🌙", "Saúde", "count", 1, ["22:30"]),
      item("Tomar sol", "☀️", "Saúde", "count", 1, ["08:00"]),
    ],
  },
  {
    id: "rotina",
    name: "Rotina básica",
    icon: "✨",
    desc: "O essencial do dia a dia",
    items: [
      item("Escovar os dentes", "🦷", "Saúde", "count", 3, ["07:00", "13:00", "22:00"]),
      item("Beber água", "💧", "Saúde", "count", 8),
      item("Dormir no horário", "🌙", "Saúde", "count", 1, ["22:30"]),
      item("Tomar creatina", "💊", "Treino", "count", 1, ["12:00"]),
    ],
  },
];
