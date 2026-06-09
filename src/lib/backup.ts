import { useStore } from "./store";

/** App version stamped into every backup file. */
export const APP_VERSION = "1.0.0";
/** Backup schema version (bump when DATA_KEYS shape changes incompatibly). */
export const BACKUP_VERSION = 3;

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
  "cofrinho",
  "weekly",
] as const;

export interface BackupFile {
  app: string;
  version: number;
  appVersion: string;
  exportedAt: string;
  state: Record<string, unknown>;
}

export interface BackupMeta {
  app: string;
  version: number;
  appVersion: string;
  exportedAt: string | null;
  /** Size of the file in bytes. */
  sizeBytes: number;
  /** How many known data sections the backup contains. */
  sections: number;
}

/** Build a plain data snapshot of the store (no functions). */
export function snapshot(): Record<string, unknown> {
  const s = useStore.getState() as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of DATA_KEYS) out[k] = s[k];
  return out;
}

/** Build the full backup payload (used for export + size preview). */
export function buildBackup(): BackupFile {
  return {
    app: "LevelUp",
    version: BACKUP_VERSION,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    state: snapshot(),
  };
}

/** Export the full backup as a downloadable JSON file. */
export function exportBackup() {
  const data = buildBackup();
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

/** Human-readable file size. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export class BackupError extends Error {}

/**
 * Validate the integrity of a parsed backup object.
 * Throws BackupError with a clear message if the file is not a valid backup.
 * Returns the normalized state object on success.
 */
export function validateBackup(parsed: unknown): Record<string, unknown> {
  if (!parsed || typeof parsed !== "object") {
    throw new BackupError("Arquivo não é um JSON válido.");
  }
  const obj = parsed as Record<string, unknown>;
  // Accept both wrapped ({ app, state }) and raw state objects.
  const state = (obj.state ?? obj) as Record<string, unknown>;
  if (!state || typeof state !== "object") {
    throw new BackupError("Estrutura do backup inválida.");
  }
  // Core sanity checks — these must exist and have the right shape.
  if (!Array.isArray(state.tasks)) {
    throw new BackupError("Backup sem a seção de tarefas (corrompido).");
  }
  if (!Array.isArray(state.habits)) {
    throw new BackupError("Backup sem a seção de hábitos (corrompido).");
  }
  if (state.settings && typeof state.settings !== "object") {
    throw new BackupError("Configurações do backup corrompidas.");
  }
  return state;
}

/**
 * Read metadata from a backup file WITHOUT applying it.
 * Used to preview date / size / version and confirm integrity before restoring.
 */
export async function readBackupMeta(file: File): Promise<BackupMeta> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new BackupError("Arquivo não é um JSON válido.");
  }
  const state = validateBackup(parsed);
  const obj = parsed as Partial<BackupFile>;
  const sections = DATA_KEYS.filter((k) => k in state).length;
  return {
    app: typeof obj.app === "string" ? obj.app : "Desconhecido",
    version: typeof obj.version === "number" ? obj.version : 0,
    appVersion: typeof obj.appVersion === "string" ? obj.appVersion : "—",
    exportedAt: typeof obj.exportedAt === "string" ? obj.exportedAt : null,
    sizeBytes: new Blob([text]).size,
    sections,
  };
}

/** Import a backup file and restore the state. Returns true on success. */
export async function importBackup(file: File): Promise<boolean> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new BackupError("Arquivo não é um JSON válido.");
  }
  const state = validateBackup(parsed);
  applyImportedState(state);
  return true;
}

export function applyImportedState(state: Record<string, unknown>) {
  const patch: Record<string, unknown> = {};
  for (const k of DATA_KEYS) {
    if (k in state) patch[k] = state[k];
  }
  useStore.setState(patch as never);
}
