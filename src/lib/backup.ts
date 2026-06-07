import { useStore } from "./store";

const DATA_KEYS = [
  "tasks",
  "habits",
  "subjects",
  "studyLog",
  "pomodoro",
  "exercises",
  "workoutLog",
  "diet",
  "antiHabits",
  "xp",
  "history",
  "badDay",
  "settings",
  "mission",
  "subjectGoals",
  "weights",
  "weightGoal",
  "sleeps",
] as const;

/** Build a plain data snapshot of the store (no functions). */
export function snapshot(): Record<string, unknown> {
  const s = useStore.getState() as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of DATA_KEYS) out[k] = s[k];
  return out;
}

/** Export the full backup as a downloadable JSON file. */
export function exportBackup() {
  const data = {
    app: "LevelUp",
    version: 2,
    exportedAt: new Date().toISOString(),
    state: snapshot(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `levelup-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Import a backup file and restore the state. Returns true on success. */
export async function importBackup(file: File): Promise<boolean> {
  const text = await file.text();
  const parsed = JSON.parse(text);
  const state = parsed?.state ?? parsed;
  if (!state || typeof state !== "object" || !Array.isArray(state.tasks)) {
    throw new Error("Arquivo de backup inválido");
  }
  const patch: Record<string, unknown> = {};
  for (const k of DATA_KEYS) {
    if (k in state) patch[k] = state[k];
  }
  useStore.setState(patch as never);
  return true;
}

export function applyImportedState(state: Record<string, unknown>) {
  const patch: Record<string, unknown> = {};
  for (const k of DATA_KEYS) {
    if (k in state) patch[k] = state[k];
  }
  useStore.setState(patch as never);
}
