import { create } from "zustand";
import { persist } from "zustand/middleware";
import { todayKey, daysBetween, startOfWeekKey } from "./dates";

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

export interface Habit {
  id: string;
  name: string;
  icon: string;
  lastDone: string | null;
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

export interface WeeklyMission {
  id: string;
  label: string;
  target: number;
  current: number;
  unit: string; // ex: "horas", "questões", "treinos"
  weekStart: string; // startOfWeekKey
}

export interface Cofrinho {
  dailyAmount: number; // R$ por dia perfeito
  requiredHabitIds: string[]; // hábitos marcados como obrigatórios
  balance: number; // saldo acumulado (ganho - resgatado)
  earnedByDay: Record<string, number>; // date -> R$ ganho
  perfectDays: string[]; // date keys de dias perfeitos
  goals: RewardGoal[];
  history: RewardRedeem[];
}

export const DEFAULT_COFRINHO: Cofrinho = {
  dailyAmount: 10,
  requiredHabitIds: [],
  balance: 0,
  earnedByDay: {},
  perfectDays: [],
  goals: [],
  history: [],
};

export const DEFAULT_SETTINGS: Settings = {
  primaryColor: "oklch(0.78 0.17 152)",
  secondaryColor: "oklch(0.7 0.16 250)",
  darkMode: "default",
};

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
  recomputeCofrinho: () => void;
  addRewardGoal: (name: string, target: number) => void;
  deleteRewardGoal: (id: string) => void;
  redeemReward: (name: string, amount: number) => void;

  // weekly mission actions
  setWeekly: (m: { label: string; target: number; unit: string } | null) => void;
  setWeeklyProgress: (current: number) => void;
}

const uid = () => Math.random().toString(36).slice(2, 10);

// Recompute today's cofrinho earning based on required habits completion.
function applyCofrinhoToday(cofrinho: Cofrinho, habits: Habit[]): Cofrinho {
  const today = todayKey();
  const required = habits.filter((h) => cofrinho.requiredHabitIds.includes(h.id));
  const allDone = required.length > 0 && required.every((h) => h.lastDone === today);
  const wasEarned = cofrinho.earnedByDay[today] || 0;
  const shouldEarn = allDone ? cofrinho.dailyAmount : 0;
  if (wasEarned === shouldEarn) return cofrinho;
  const balance = cofrinho.balance - wasEarned + shouldEarn;
  const earnedByDay = { ...cofrinho.earnedByDay, [today]: shouldEarn };
  const perfectDays = allDone
    ? Array.from(new Set([...cofrinho.perfectDays, today]))
    : cofrinho.perfectDays.filter((d) => d !== today);
  return { ...cofrinho, balance, earnedByDay, perfectDays };
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
        { id: uid(), name: "Escovar os dentes", icon: "🦷", lastDone: null },
        { id: uid(), name: "Tomar creatina", icon: "💊", lastDone: null },
        { id: uid(), name: "Beber água", icon: "💧", lastDone: null },
        { id: uid(), name: "Dormir no horário", icon: "🌙", lastDone: null },
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
          let gained = 0;
          const habits = s.habits.map((h) => {
            if (h.id !== id) return h;
            const willDo = h.lastDone !== today;
            gained = willDo ? 5 : -5;
            return { ...h, lastDone: willDo ? today : null };
          });
          return { habits, xp: Math.max(0, s.xp + gained), cofrinho: applyCofrinhoToday(s.cofrinho, habits) };
        }),

      addSubject: (name) =>
        set((s) => ({ subjects: [...s.subjects, { id: uid(), name, sessions: 0, totalSeconds: 0 }] })),

      deleteSubject: (id) =>
        set((s) => ({ subjects: s.subjects.filter((x) => x.id !== id) })),

      logStudy: (subjectId, seconds) =>
        set((s) => ({
          subjects: s.subjects.map((x) =>
            x.id === subjectId
              ? { ...x, sessions: x.sessions + 1, totalSeconds: x.totalSeconds + seconds }
              : x,
          ),
          studyLog: [...s.studyLog, { date: todayKey(), subjectId, seconds }],
          xp: s.xp + Math.max(5, Math.round(seconds / 60)),
        })),

      setPomodoro: (focusMin, breakMin) => set({ pomodoro: { focusMin, breakMin } }),

      addExercise: (e) => set((s) => ({ exercises: [...s.exercises, { ...e, id: uid() }] })),
      deleteExercise: (id) => set((s) => ({ exercises: s.exercises.filter((x) => x.id !== id) })),

      toggleWorkoutToday: () =>
        set((s) => {
          const today = todayKey();
          const has = s.workoutLog.includes(today);
          return {
            workoutLog: has ? s.workoutLog.filter((d) => d !== today) : [...s.workoutLog, today],
            xp: Math.max(0, s.xp + (has ? -20 : 20)),
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
    }),
    {
      name: "levelup-store",
      version: 2,
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
