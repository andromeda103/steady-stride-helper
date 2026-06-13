import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { todayKey, daysBetween, startOfWeekKey, endOfWeekKey } from "./dates";
import { getStorage } from "./persistence";
import { computeDayStatus, brl } from "./cofrinho";

export type Category =
  | "Estudos"
  | "Treino"
  | "Dieta"
  | "Saúde"
  | "Trabalho"
  | "Pessoal";

export type Priority = "Alta" | "Média" | "Baixa";

export const CATEGORIES: Category[] = [
  "Estudos",
  "Treino",
  "Dieta",
  "Saúde",
  "Trabalho",
  "Pessoal",
];

export const PRIORITIES: Priority[] = ["Alta", "Média", "Baixa"];

export const CATEGORY_VAR: Record<Category, string> = {
  Estudos: "var(--cat-estudos)",
  Treino: "var(--cat-treino)",
  Dieta: "var(--cat-dieta)",
  Saúde: "var(--cat-saude)",
  Trabalho: "var(--cat-trabalho)",
  Pessoal: "var(--cat-pessoal)",
};

export interface Task {
  id: string;
  name: string;
  time: string; // HH:mm, empty = anytime
  category: Category;
  priority: Priority;
  essential: boolean; // kept on "dia ruim"
  lastDone: string | null; // date key when last completed
}

export type HabitMode = "count" | "time";

export interface Habit {
  id: string;
  name: string;
  icon: string;
  category: Category;
  mode: HabitMode; // "count" = vezes/dia | "time" = minutos/dia
  target: number; // meta diária (vezes ou minutos)
  times: string[]; // horários múltiplos (HH:mm) para lembretes
  pomodoroLinked: boolean; // soma tempo do Pomodoro automaticamente (modo time)
  logByDay: Record<string, number>; // date -> progresso do dia (vezes ou minutos)
  lastDone: string | null; // último dia em que a meta foi atingida (compat cofrinho)
}

export interface Subject {
  id: string;
  name: string;
  sessions: number;
  totalSeconds: number;
}

export interface StudyEntry {
  date: string;
  subjectId: string;
  seconds: number;
}

export interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: number;
}

export interface MealPreset {
  id: string;
  name: string;
  calories: number;
  protein: number;
}

export interface MealEntry {
  id: string;
  date: string;
  name: string;
  calories: number;
  protein: number;
}

export interface AntiHabit {
  id: string;
  name: string;
  since: string; // date key of last reset / start
  best: number; // best streak in days
}

export interface FocusSession {
  taskId: string;
  endsAt: number; // epoch ms
}

export type DarkMode = "default" | "amoled" | "gray";

export interface Settings {
  primaryColor: string; // oklch/hex applied to --primary
  secondaryColor: string; // accent used in highlights
  darkMode: DarkMode;
}

export interface WeightEntry {
  id: string;
  date: string;
  kg: number;
}

export interface SleepEntry {
  id: string;
  date: string;
  bed: string; // HH:mm
  wake: string; // HH:mm
  hours: number;
}

export type NotifKind =
  | "permission"
  | "service_worker"
  | "sent"
  | "triggered"
  | "received"
  | "error"
  | "scheduled"
  | "cancelled";

export interface NotifEvent {
  id: string;
  at: number; // epoch ms
  kind: NotifKind;
  title: string;
  detail?: string;
}

export interface ScheduledNotif {
  id: string;
  fireAt: number; // epoch ms
  title: string;
  body: string;
}

export interface Mission {
  taskId: string;
  date: string;
}

export interface RewardGoal {
  id: string;
  name: string;
  target: number; // R$
}

export interface RewardRedeem {
  id: string;
  name: string;
  amount: number; // R$
  date: string; // date key
}

/** Lançamento financeiro unificado (entrada + saída). */
export interface LedgerEntry {
  id: string;
  date: string; // date key
  at: number; // epoch ms (ordenação)
  amount: number; // +ganho / -gasto
  reason: string;
}

export type CofrinhoEventKind = "earned" | "lost" | "amount_changed" | "purchase" | "config" | "test";

/** Evento de auditoria do cofrinho. */
export interface CofrinhoEvent {
  id: string;
  at: number; // epoch ms
  kind: CofrinhoEventKind;
  detail: string;
}

export interface WeeklyMission {
  id: string;
  label: string;
  target: number;
  current: number;
  unit: string; // ex: "horas", "questões", "treinos"
  weekStart: string; // startOfWeekKey
  deadline: string; // date key (YYYY-MM-DD) — prazo final da missão
}

export interface Cofrinho {
  dailyAmount: number; // R$ por dia perfeito
  requiredHabitIds: string[]; // hábitos marcados como obrigatórios
  requiredTaskIds: string[]; // tarefas marcadas como obrigatórias
  minStudyMinutes: number; // estudo mínimo do dia (0 = desativado)
  requireWorkout: boolean; // exige treino concluído no dia
  balance: number; // saldo acumulado (ganho - resgatado)
  earnedByDay: Record<string, number>; // date -> R$ ganho
  perfectDays: string[]; // date keys de dias perfeitos
  rewardGrantedDates: string[]; // dias em que a recompensa já foi concedida (evita duplicidade)
  lastRewardDate: string | null; // último dia em que a recompensa foi concedida
  goals: RewardGoal[];
  history: RewardRedeem[]; // resgates (compat)
  ledger: LedgerEntry[]; // histórico financeiro unificado
  events: CofrinhoEvent[]; // log de auditoria
}

export const DEFAULT_COFRINHO: Cofrinho = {
  dailyAmount: 10,
  requiredHabitIds: [],
  requiredTaskIds: [],
  minStudyMinutes: 0,
  requireWorkout: false,
  balance: 0,
  earnedByDay: {},
  perfectDays: [],
  rewardGrantedDates: [],
  lastRewardDate: null,
  goals: [],
  history: [],
  ledger: [],
  events: [],
};

export const DEFAULT_SETTINGS: Settings = {
  primaryColor: "oklch(0.78 0.17 152)",
  secondaryColor: "oklch(0.7 0.16 250)",
  darkMode: "default",
};

/** Resultado de uma checagem/concessão da recompensa diária. */
export interface CofrinhoCheckResult {
  outcome: "granted" | "already" | "pending" | "no_rules";
  amount: number;
  missing: string[]; // requisitos pendentes (quando outcome === "pending")
}

/** Resultado de uma simulação (não altera dados reais). */
export interface CofrinhoSimResult {
  wouldGrant: boolean;
  amount: number;
  missing: string[];
}


interface State {
  tasks: Task[];
  habits: Habit[];
  subjects: Subject[];
  studyLog: StudyEntry[];
  pomodoro: { focusMin: number; breakMin: number };
  exercises: Exercise[];
  workoutLog: string[]; // date keys workout completed
  diet: {
    calorieGoal: number;
    waterGoal: number; // ml
    proteinGoal: number;
    presets: MealPreset[];
    meals: MealEntry[];
    waterByDay: Record<string, number>;
  };
  antiHabits: AntiHabit[];
  xp: number;
  history: Record<string, number>; // date -> percent of tasks done
  badDay: { date: string } | null;
  focus: FocusSession | null;
  notifPermission: NotificationPermission | "default";
  lastReminderAt: Record<string, number>; // taskId -> epoch ms

  // new slices
  settings: Settings;
  mission: Mission | null;
  subjectGoals: Record<string, number>; // subjectId -> planned hours/week
  weights: WeightEntry[];
  weightGoal: number;
  sleeps: SleepEntry[];
  notifLog: NotifEvent[];
  scheduled: ScheduledNotif[];
  lastActiveAt: number;
  cofrinho: Cofrinho;
  weekly: WeeklyMission | null;

  // actions
  toggleTask: (id: string) => void;
  addTask: (t: Omit<Task, "id" | "lastDone">) => void;
  deleteTask: (id: string) => void;
  toggleHabit: (id: string) => void;
  incHabit: (id: string, delta: number) => void;
  setHabitProgress: (id: string, value: number) => void;
  addHabit: (h: Omit<Habit, "id" | "logByDay" | "lastDone">) => void;
  addHabitsFromTemplate: (items: Array<Omit<Habit, "id" | "logByDay" | "lastDone">>) => void;
  deleteHabit: (id: string) => void;
  addPomodoroMinutes: (minutes: number) => void;
  addSubject: (name: string) => void;
  deleteSubject: (id: string) => void;
  logStudy: (subjectId: string, seconds: number) => void;
  setPomodoro: (focusMin: number, breakMin: number) => void;
  addExercise: (e: Omit<Exercise, "id">) => void;
  deleteExercise: (id: string) => void;
  toggleWorkoutToday: () => void;
  setDietGoals: (g: { calorieGoal: number; waterGoal: number; proteinGoal: number }) => void;
  addMealPreset: (p: Omit<MealPreset, "id">) => void;
  deleteMealPreset: (id: string) => void;
  logMeal: (m: Omit<MealEntry, "id" | "date">) => void;
  deleteMeal: (id: string) => void;
  addWater: (ml: number) => void;
  addAntiHabit: (name: string) => void;
  failAntiHabit: (id: string) => void;
  deleteAntiHabit: (id: string) => void;
  setBadDay: (on: boolean) => void;
  startFocus: (taskId: string, minutes: number) => void;
  clearFocus: () => void;
  setNotifPermission: (p: NotificationPermission) => void;
  markReminded: (taskId: string) => void;
  addXp: (n: number) => void;

  // new actions
  setSettings: (patch: Partial<Settings>) => void;
  setMission: (taskId: string | null) => void;
  setSubjectGoal: (subjectId: string, hours: number) => void;
  addWeight: (kg: number) => void;
  deleteWeight: (id: string) => void;
  setWeightGoal: (kg: number) => void;
  addSleep: (bed: string, wake: string) => void;
  deleteSleep: (id: string) => void;
  logNotif: (kind: NotifKind, title: string, detail?: string) => void;
  clearNotifLog: () => void;
  addScheduled: (s: ScheduledNotif) => void;
  removeScheduled: (id: string) => void;
  touchActive: () => void;

  // cofrinho actions
  setDailyAmount: (amount: number) => void;
  toggleRequiredHabit: (habitId: string) => void;
  toggleRequiredTask: (taskId: string) => void;
  setMinStudyMinutes: (minutes: number) => void;
  setRequireWorkout: (on: boolean) => void;
  recomputeCofrinho: () => void;
  addRewardGoal: (name: string, target: number) => void;
  deleteRewardGoal: (id: string) => void;
  redeemReward: (name: string, amount: number) => void;
  logCofrinhoEvent: (kind: CofrinhoEventKind, detail: string) => void;

  // weekly mission actions
  setWeekly: (m: { label: string; target: number; unit: string; deadline?: string } | null) => void;
  setWeeklyProgress: (current: number) => void;
}

const uid = () => Math.random().toString(36).slice(2, 10);

function cofEvent(kind: CofrinhoEventKind, detail: string): CofrinhoEvent {
  return { id: uid(), at: Date.now(), kind, detail };
}

interface CofInputs {
  cofrinho: Cofrinho;
  habits: Habit[];
  tasks: Task[];
  studyLog: StudyEntry[];
  workoutLog: string[];
}

// Grant today's cofrinho reward IF (and only if) all required criteria are met
// AND the reward was not already granted today. Granting is "locked" per day:
// once granted, unchecking tasks/habits later does NOT remove the money.
// This guarantees the reward is never added twice in the same day.
function applyCofrinhoToday(input: CofInputs): Cofrinho {
  const { cofrinho, habits, tasks, studyLog, workoutLog } = input;
  const today = todayKey();
  const granted = (cofrinho.rewardGrantedDates ?? []).includes(today);
  // Already paid today → nothing to do (locked, no duplicate, no removal).
  if (granted) return cofrinho;

  const status = computeDayStatus(cofrinho, habits, tasks, studyLog, workoutLog);
  // Not a perfect day yet (or no rules configured) → keep waiting.
  if (!status.perfect) return cofrinho;

  const amount = cofrinho.dailyAmount;
  const earnedByDay = { ...cofrinho.earnedByDay, [today]: amount };
  const perfectDays = Array.from(new Set([...cofrinho.perfectDays, today]));
  const rewardGrantedDates = Array.from(new Set([...(cofrinho.rewardGrantedDates ?? []), today]));
  const ledger =
    amount > 0
      ? [{ id: uid(), date: today, at: Date.now(), amount, reason: "Dia perfeito" }, ...cofrinho.ledger]
      : cofrinho.ledger;
  const events =
    amount > 0
      ? [cofEvent("earned", `Recompensa de ${brl(amount)} liberada (dia perfeito)`), ...cofrinho.events].slice(0, 120)
      : cofrinho.events;
  const balance = ledger.reduce((a, e) => a + e.amount, 0);

  return {
    ...cofrinho,
    balance,
    earnedByDay,
    perfectDays,
    rewardGrantedDates,
    lastRewardDate: amount > 0 ? today : cofrinho.lastRewardDate,
    ledger,
    events,
  };
}

// Recompute helper that pulls all relevant slices from the current state,
// allowing callers to pass freshly-updated arrays as overrides.
function recompCof(s: State, over?: Partial<CofInputs>): Cofrinho {
  return applyCofrinhoToday({
    cofrinho: over?.cofrinho ?? s.cofrinho,
    habits: over?.habits ?? s.habits,
    tasks: over?.tasks ?? s.tasks,
    studyLog: over?.studyLog ?? s.studyLog,
    workoutLog: over?.workoutLog ?? s.workoutLog,
  });
}




// Set today's progress for a habit and keep `lastDone` (target reached) in sync.
function setHabitToday(habits: Habit[], id: string, value: number): Habit[] {
  const today = todayKey();
  return habits.map((h) => {
    if (h.id !== id) return h;
    const v = Math.max(0, Math.round(value));
    const logByDay = { ...h.logByDay, [today]: v };
    const done = h.target > 0 && v >= h.target;
    const lastDone = done ? today : h.lastDone === today ? null : h.lastDone;
    return { ...h, logByDay, lastDone };
  });
}

function recomputeHistory(tasks: Task[]): Record<string, number> {
  const today = todayKey();
  const total = tasks.length;
  const done = tasks.filter((t) => t.lastDone === today).length;
  return { [today]: total === 0 ? 0 : Math.round((done / total) * 100) };
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      tasks: [
        { id: uid(), name: "Beber água", time: "07:00", category: "Saúde", priority: "Média", essential: true, lastDone: null },
        { id: uid(), name: "Estudar Direito Penal", time: "09:00", category: "Estudos", priority: "Alta", essential: true, lastDone: null },
        { id: uid(), name: "Tomar creatina", time: "12:30", category: "Treino", priority: "Média", essential: false, lastDone: null },
        { id: uid(), name: "Almoçar", time: "13:00", category: "Dieta", priority: "Média", essential: true, lastDone: null },
        { id: uid(), name: "Fazer treino", time: "18:00", category: "Treino", priority: "Alta", essential: false, lastDone: null },
      ],
      habits: [
        { id: uid(), name: "Escovar os dentes", icon: "🦷", category: "Saúde", mode: "count", target: 3, times: ["07:00", "13:00", "22:00"], pomodoroLinked: false, logByDay: {}, lastDone: null },
        { id: uid(), name: "Beber água", icon: "💧", category: "Saúde", mode: "count", target: 8, times: [], pomodoroLinked: false, logByDay: {}, lastDone: null },
        { id: uid(), name: "Tomar creatina", icon: "💊", category: "Treino", mode: "count", target: 1, times: ["12:30"], pomodoroLinked: false, logByDay: {}, lastDone: null },
        { id: uid(), name: "Estudar", icon: "📚", category: "Estudos", mode: "time", target: 240, times: [], pomodoroLinked: true, logByDay: {}, lastDone: null },
        { id: uid(), name: "Dormir no horário", icon: "🌙", category: "Saúde", mode: "count", target: 1, times: ["22:30"], pomodoroLinked: false, logByDay: {}, lastDone: null },
      ],
      subjects: [
        { id: uid(), name: "Português", sessions: 0, totalSeconds: 0 },
        { id: uid(), name: "Direito Penal", sessions: 0, totalSeconds: 0 },
        { id: uid(), name: "Raciocínio Lógico", sessions: 0, totalSeconds: 0 },
      ],
      studyLog: [],
      pomodoro: { focusMin: 30, breakMin: 20 },
      exercises: [
        { id: uid(), name: "Supino reto", sets: 4, reps: 10 },
        { id: uid(), name: "Agachamento", sets: 4, reps: 12 },
        { id: uid(), name: "Remada curvada", sets: 3, reps: 12 },
      ],
      workoutLog: [],
      diet: {
        calorieGoal: 2200,
        waterGoal: 3000,
        proteinGoal: 150,
        presets: [
          { id: uid(), name: "Whey + banana", calories: 250, protein: 30 },
          { id: uid(), name: "Frango + arroz", calories: 550, protein: 45 },
          { id: uid(), name: "Ovos mexidos", calories: 220, protein: 18 },
        ],
        meals: [],
        waterByDay: {},
      },
      antiHabits: [
        { id: uid(), name: "Dias sem procrastinar", since: todayKey(), best: 0 },
        { id: uid(), name: "Dias sem faltar ao estudo", since: todayKey(), best: 0 },
      ],
      xp: 0,
      history: {},
      badDay: null,
      focus: null,
      notifPermission: "default",
      lastReminderAt: {},

      settings: DEFAULT_SETTINGS,
      mission: null,
      subjectGoals: {},
      weights: [],
      weightGoal: 0,
      sleeps: [],
      notifLog: [],
      scheduled: [],
      lastActiveAt: Date.now(),
      cofrinho: DEFAULT_COFRINHO,
      weekly: null,

      toggleTask: (id) =>
        set((s) => {
          const today = todayKey();
          let gained = 0;
          const tasks = s.tasks.map((t) => {
            if (t.id !== id) return t;
            const willDo = t.lastDone !== today;
            gained = willDo ? 10 : -10;
            return { ...t, lastDone: willDo ? today : null };
          });
          return {
            tasks,
            xp: Math.max(0, s.xp + gained),
            history: { ...s.history, ...recomputeHistory(tasks) },
            cofrinho: recompCof(s, { tasks }),
          };
        }),

      addTask: (t) =>
        set((s) => {
          const tasks = [...s.tasks, { ...t, id: uid(), lastDone: null }];
          return { tasks, history: { ...s.history, ...recomputeHistory(tasks) } };
        }),

      deleteTask: (id) =>
        set((s) => {
          const tasks = s.tasks.filter((t) => t.id !== id);
          return { tasks, history: { ...s.history, ...recomputeHistory(tasks) } };
        }),

      toggleHabit: (id) =>
        set((s) => {
          const today = todayKey();
          const h = s.habits.find((x) => x.id === id);
          if (!h) return {};
          const cur = h.logByDay[today] ?? 0;
          const wasDone = h.target > 0 && cur >= h.target;
          const habits = setHabitToday(s.habits, id, wasDone ? 0 : h.target);
          const xp = Math.max(0, s.xp + (wasDone ? -5 : 5));
          return { habits, xp, cofrinho: recompCof(s, { habits }) };
        }),

      incHabit: (id, delta) =>
        set((s) => {
          const today = todayKey();
          const h = s.habits.find((x) => x.id === id);
          if (!h) return {};
          const cur = h.logByDay[today] ?? 0;
          const next = Math.max(0, cur + delta);
          const wasDone = h.target > 0 && cur >= h.target;
          const isDone = h.target > 0 && next >= h.target;
          const habits = setHabitToday(s.habits, id, next);
          const xp = Math.max(0, s.xp + (isDone && !wasDone ? 5 : !isDone && wasDone ? -5 : 0));
          return { habits, xp, cofrinho: recompCof(s, { habits }) };
        }),

      setHabitProgress: (id, value) =>
        set((s) => {
          const today = todayKey();
          const h = s.habits.find((x) => x.id === id);
          if (!h) return {};
          const cur = h.logByDay[today] ?? 0;
          const wasDone = h.target > 0 && cur >= h.target;
          const isDone = h.target > 0 && value >= h.target;
          const habits = setHabitToday(s.habits, id, value);
          const xp = Math.max(0, s.xp + (isDone && !wasDone ? 5 : !isDone && wasDone ? -5 : 0));
          return { habits, xp, cofrinho: recompCof(s, { habits }) };
        }),

      addHabit: (h) =>
        set((s) => ({
          habits: [...s.habits, { ...h, id: uid(), logByDay: {}, lastDone: null }],
        })),

      addHabitsFromTemplate: (items) =>
        set((s) => ({
          habits: [...s.habits, ...items.map((it) => ({ ...it, id: uid(), logByDay: {}, lastDone: null }))],
        })),

      deleteHabit: (id) =>
        set((s) => ({
          habits: s.habits.filter((h) => h.id !== id),
          cofrinho: { ...s.cofrinho, requiredHabitIds: s.cofrinho.requiredHabitIds.filter((x) => x !== id) },
        })),

      addPomodoroMinutes: (minutes) =>
        set((s) => {
          const today = todayKey();
          let habits = s.habits;
          let xpGain = 0;
          for (const h of s.habits) {
            if (h.mode !== "time" || !h.pomodoroLinked) continue;
            const cur = h.logByDay[today] ?? 0;
            const next = cur + minutes;
            const wasDone = h.target > 0 && cur >= h.target;
            const isDone = h.target > 0 && next >= h.target;
            habits = setHabitToday(habits, h.id, next);
            if (isDone && !wasDone) xpGain += 5;
          }
          if (habits === s.habits) return {};
          return { habits, xp: Math.max(0, s.xp + xpGain), cofrinho: recompCof(s, { habits }) };
        }),


      addSubject: (name) =>
        set((s) => ({ subjects: [...s.subjects, { id: uid(), name, sessions: 0, totalSeconds: 0 }] })),

      deleteSubject: (id) =>
        set((s) => ({ subjects: s.subjects.filter((x) => x.id !== id) })),

      logStudy: (subjectId, seconds) =>
        set((s) => {
          const studyLog = [...s.studyLog, { date: todayKey(), subjectId, seconds }];
          return {
            subjects: s.subjects.map((x) =>
              x.id === subjectId
                ? { ...x, sessions: x.sessions + 1, totalSeconds: x.totalSeconds + seconds }
                : x,
            ),
            studyLog,
            xp: s.xp + Math.max(5, Math.round(seconds / 60)),
            cofrinho: recompCof(s, { studyLog }),
          };
        }),

      setPomodoro: (focusMin, breakMin) => set({ pomodoro: { focusMin, breakMin } }),

      addExercise: (e) => set((s) => ({ exercises: [...s.exercises, { ...e, id: uid() }] })),
      deleteExercise: (id) => set((s) => ({ exercises: s.exercises.filter((x) => x.id !== id) })),

      toggleWorkoutToday: () =>
        set((s) => {
          const today = todayKey();
          const has = s.workoutLog.includes(today);
          const workoutLog = has ? s.workoutLog.filter((d) => d !== today) : [...s.workoutLog, today];
          return {
            workoutLog,
            xp: Math.max(0, s.xp + (has ? -20 : 20)),
            cofrinho: recompCof(s, { workoutLog }),
          };
        }),

      setDietGoals: (g) => set((s) => ({ diet: { ...s.diet, ...g } })),
      addMealPreset: (p) => set((s) => ({ diet: { ...s.diet, presets: [...s.diet.presets, { ...p, id: uid() }] } })),
      deleteMealPreset: (id) =>
        set((s) => ({ diet: { ...s.diet, presets: s.diet.presets.filter((x) => x.id !== id) } })),
      logMeal: (m) =>
        set((s) => ({
          diet: { ...s.diet, meals: [...s.diet.meals, { ...m, id: uid(), date: todayKey() }] },
          xp: s.xp + 3,
        })),
      deleteMeal: (id) =>
        set((s) => ({ diet: { ...s.diet, meals: s.diet.meals.filter((x) => x.id !== id) } })),
      addWater: (ml) =>
        set((s) => {
          const today = todayKey();
          const cur = s.diet.waterByDay[today] || 0;
          return { diet: { ...s.diet, waterByDay: { ...s.diet.waterByDay, [today]: Math.max(0, cur + ml) } } };
        }),

      addAntiHabit: (name) =>
        set((s) => ({ antiHabits: [...s.antiHabits, { id: uid(), name, since: todayKey(), best: 0 }] })),
      failAntiHabit: (id) =>
        set((s) => ({
          antiHabits: s.antiHabits.map((a) => {
            if (a.id !== id) return a;
            const streak = daysBetween(a.since);
            return { ...a, since: todayKey(), best: Math.max(a.best, streak) };
          }),
        })),
      deleteAntiHabit: (id) => set((s) => ({ antiHabits: s.antiHabits.filter((x) => x.id !== id) })),

      setBadDay: (on) => set({ badDay: on ? { date: todayKey() } : null }),

      startFocus: (taskId, minutes) => set({ focus: { taskId, endsAt: Date.now() + minutes * 60000 } }),
      clearFocus: () => set({ focus: null }),

      setNotifPermission: (p) => set({ notifPermission: p }),
      markReminded: (taskId) =>
        set((s) => ({ lastReminderAt: { ...s.lastReminderAt, [taskId]: Date.now() } })),
      addXp: (n) => set((s) => ({ xp: Math.max(0, s.xp + n) })),

      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      setMission: (taskId) =>
        set(() => ({ mission: taskId ? { taskId, date: todayKey() } : null })),

      setSubjectGoal: (subjectId, hours) =>
        set((s) => ({ subjectGoals: { ...s.subjectGoals, [subjectId]: Math.max(0, hours) } })),

      addWeight: (kg) =>
        set((s) => {
          const today = todayKey();
          const rest = s.weights.filter((w) => w.date !== today);
          return {
            weights: [...rest, { id: uid(), date: today, kg }].sort((a, b) => a.date.localeCompare(b.date)),
          };
        }),
      deleteWeight: (id) => set((s) => ({ weights: s.weights.filter((w) => w.id !== id) })),
      setWeightGoal: (kg) => set({ weightGoal: Math.max(0, kg) }),

      addSleep: (bed, wake) =>
        set((s) => {
          const bm = bed.split(":").map(Number);
          const wm = wake.split(":").map(Number);
          const bedMin = (bm[0] || 0) * 60 + (bm[1] || 0);
          const wakeMin = (wm[0] || 0) * 60 + (wm[1] || 0);
          const hours = Math.round((((wakeMin - bedMin + 1440) % 1440) / 60) * 10) / 10;
          const today = todayKey();
          const rest = s.sleeps.filter((x) => x.date !== today);
          return {
            sleeps: [...rest, { id: uid(), date: today, bed, wake, hours }].sort((a, b) => a.date.localeCompare(b.date)),
          };
        }),
      deleteSleep: (id) => set((s) => ({ sleeps: s.sleeps.filter((x) => x.id !== id) })),

      logNotif: (kind, title, detail) =>
        set((s) => ({
          notifLog: [{ id: uid(), at: Date.now(), kind, title, detail }, ...s.notifLog].slice(0, 60),
        })),
      clearNotifLog: () => set({ notifLog: [] }),
      addScheduled: (sc) => set((s) => ({ scheduled: [...s.scheduled, sc] })),
      removeScheduled: (id) => set((s) => ({ scheduled: s.scheduled.filter((x) => x.id !== id) })),

      touchActive: () => set({ lastActiveAt: Date.now() }),

      setDailyAmount: (amount) =>
        set((s) => {
          const value = Math.max(0, amount);
          const prev = s.cofrinho.dailyAmount;
          let cofrinho = { ...s.cofrinho, dailyAmount: value };
          if (value !== prev) {
            cofrinho = {
              ...cofrinho,
              events: [cofEvent("amount_changed", `Valor por dia alterado: ${brl(prev)} → ${brl(value)}`), ...cofrinho.events].slice(0, 120),
            };
          }
          return { cofrinho: recompCof(s, { cofrinho }) };
        }),

      toggleRequiredHabit: (habitId) =>
        set((s) => {
          const has = s.cofrinho.requiredHabitIds.includes(habitId);
          const requiredHabitIds = has
            ? s.cofrinho.requiredHabitIds.filter((x) => x !== habitId)
            : [...s.cofrinho.requiredHabitIds, habitId];
          return { cofrinho: recompCof(s, { cofrinho: { ...s.cofrinho, requiredHabitIds } }) };
        }),

      toggleRequiredTask: (taskId) =>
        set((s) => {
          const list = s.cofrinho.requiredTaskIds ?? [];
          const has = list.includes(taskId);
          const requiredTaskIds = has ? list.filter((x) => x !== taskId) : [...list, taskId];
          return { cofrinho: recompCof(s, { cofrinho: { ...s.cofrinho, requiredTaskIds } }) };
        }),

      setMinStudyMinutes: (minutes) =>
        set((s) => {
          const minStudyMinutes = Math.max(0, Math.round(minutes));
          return { cofrinho: recompCof(s, { cofrinho: { ...s.cofrinho, minStudyMinutes } }) };
        }),

      setRequireWorkout: (on) =>
        set((s) => ({ cofrinho: recompCof(s, { cofrinho: { ...s.cofrinho, requireWorkout: on } }) })),

      recomputeCofrinho: () => set((s) => ({ cofrinho: recompCof(s) })),

      logCofrinhoEvent: (kind, detail) =>
        set((s) => ({
          cofrinho: { ...s.cofrinho, events: [cofEvent(kind, detail), ...s.cofrinho.events].slice(0, 120) },
        })),

      addRewardGoal: (name, target) =>
        set((s) => ({
          cofrinho: { ...s.cofrinho, goals: [...s.cofrinho.goals, { id: uid(), name, target: Math.max(1, target) }] },
        })),

      deleteRewardGoal: (id) =>
        set((s) => ({ cofrinho: { ...s.cofrinho, goals: s.cofrinho.goals.filter((g) => g.id !== id) } })),

      redeemReward: (name, amount) =>
        set((s) => {
          if (amount > s.cofrinho.balance) return {};
          const today = todayKey();
          const ledger = [
            { id: uid(), date: today, at: Date.now(), amount: -Math.abs(amount), reason: `Compra: ${name}` },
            ...s.cofrinho.ledger,
          ];
          return {
            cofrinho: {
              ...s.cofrinho,
              balance: ledger.reduce((a, e) => a + e.amount, 0),
              ledger,
              history: [{ id: uid(), name, amount, date: today }, ...s.cofrinho.history],
              events: [cofEvent("purchase", `Compra realizada: ${name} (-${brl(amount)})`), ...s.cofrinho.events].slice(0, 120),
            },
          };
        }),


      setWeekly: (m) =>
        set(() =>
          m
            ? {
                weekly: {
                  id: uid(),
                  label: m.label,
                  target: Math.max(1, m.target),
                  current: 0,
                  unit: m.unit,
                  weekStart: startOfWeekKey(),
                  deadline: m.deadline || endOfWeekKey(),
                },
              }
            : { weekly: null },
        ),

      setWeeklyProgress: (current) =>
        set((s) => (s.weekly ? { weekly: { ...s.weekly, current: Math.max(0, current) } } : {})),
    }),
    {
      name: "levelup-store",
      version: 6,
      storage: createJSONStorage(() => getStorage()),
      migrate: (persisted: unknown, version: number) => {
        const state = (persisted ?? {}) as Record<string, unknown>;
        if (version < 2) {
          if (!state.settings) state.settings = DEFAULT_SETTINGS;
          if (!state.mission) state.mission = null;
          if (!state.subjectGoals) state.subjectGoals = {};
          if (!state.weights) state.weights = [];
          if (state.weightGoal == null) state.weightGoal = 0;
          if (!state.sleeps) state.sleeps = [];
          if (!state.notifLog) state.notifLog = [];
          if (!state.scheduled) state.scheduled = [];
          if (state.lastActiveAt == null) state.lastActiveAt = Date.now();
        }
        if (version < 3) {
          if (!state.cofrinho) state.cofrinho = DEFAULT_COFRINHO;
          if (state.weekly === undefined) state.weekly = null;
        }
        if (version < 4) {
          const w = state.weekly as Record<string, unknown> | null | undefined;
          if (w && typeof w === "object" && !w.deadline) {
            const ws = typeof w.weekStart === "string" ? w.weekStart : startOfWeekKey();
            w.deadline = endOfWeekKey(new Date(ws + "T00:00:00"));
          }
        }
        if (version < 5) {
          const today = todayKey();
          const hs = Array.isArray(state.habits) ? (state.habits as Record<string, unknown>[]) : [];
          state.habits = hs.map((h) => {
            const target = typeof h.target === "number" ? h.target : 1;
            const legacyTime = typeof h.time === "string" ? (h.time as string) : "";
            const times = Array.isArray(h.times) ? h.times : legacyTime ? [legacyTime] : [];
            const logByDay =
              h.logByDay && typeof h.logByDay === "object"
                ? (h.logByDay as Record<string, number>)
                : h.lastDone === today
                  ? { [today]: target }
                  : {};
            return {
              id: typeof h.id === "string" ? h.id : uid(),
              name: typeof h.name === "string" ? h.name : "Hábito",
              icon: typeof h.icon === "string" ? h.icon : "✅",
              category: typeof h.category === "string" ? h.category : "Saúde",
              mode: h.mode === "time" ? "time" : "count",
              target,
              times,
              pomodoroLinked: !!h.pomodoroLinked,
              logByDay,
              lastDone: typeof h.lastDone === "string" ? h.lastDone : null,
            };
          });
        }
        if (version < 6) {
          const c = (state.cofrinho ?? {}) as Record<string, unknown>;
          const earnedByDay = (c.earnedByDay ?? {}) as Record<string, number>;
          // Reconstrói o ledger a partir dos ganhos diários e do histórico de resgates.
          const ledger: LedgerEntry[] = [];
          for (const [date, amount] of Object.entries(earnedByDay)) {
            if (amount > 0) ledger.push({ id: uid(), date, at: new Date(date + "T12:00:00").getTime(), amount, reason: "Dia perfeito" });
          }
          const hist = Array.isArray(c.history) ? (c.history as RewardRedeem[]) : [];
          for (const r of hist) {
            ledger.push({ id: uid(), date: r.date, at: new Date(r.date + "T12:00:00").getTime(), amount: -Math.abs(r.amount), reason: `Compra: ${r.name}` });
          }
          ledger.sort((a, b) => b.at - a.at);
          state.cofrinho = {
            ...DEFAULT_COFRINHO,
            ...c,
            requiredTaskIds: Array.isArray(c.requiredTaskIds) ? c.requiredTaskIds : [],
            minStudyMinutes: typeof c.minStudyMinutes === "number" ? c.minStudyMinutes : 0,
            requireWorkout: !!c.requireWorkout,
            ledger: Array.isArray(c.ledger) ? c.ledger : ledger,
            events: Array.isArray(c.events) ? c.events : [],
          };
        }

        return state as unknown as State;
      },
    },
  ),
);

// ---- Derived selectors (pure helpers) ----

export function levelInfo(xp: number) {
  const level = Math.floor(xp / 120) + 1;
  const inLevel = xp % 120;
  return { level, inLevel, need: 120, pct: Math.round((inLevel / 120) * 100) };
}

export function isDoneToday(lastDone: string | null) {
  return lastDone === todayKey();
}

const PRIORITY_RANK: Record<Priority, number> = { Alta: 0, Média: 1, Baixa: 2 };

export function sortTasks(tasks: Task[]) {
  return [...tasks].sort((a, b) => {
    if (PRIORITY_RANK[a.priority] !== PRIORITY_RANK[b.priority])
      return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    const ta = a.time || "99:99";
    const tb = b.time || "99:99";
    return ta.localeCompare(tb);
  });
}

export function pendingTasks(tasks: Task[], badDay: boolean) {
  const today = todayKey();
  let pend = tasks.filter((t) => t.lastDone !== today);
  if (badDay) pend = pend.filter((t) => t.essential);
  return sortTasks(pend);
}
