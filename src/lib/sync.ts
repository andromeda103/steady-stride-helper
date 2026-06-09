// ============================================================================
// Cloud sync engine — offline-first, last-write-wins per-user snapshot.
//
// Model (chosen by the user): the ENTIRE app state is stored as a single JSON
// document per user in `public.user_state`. This keeps the app fully functional
// offline (zustand -> localStorage) and only pushes/pulls when:
//   - the user is signed in, AND
//   - the device is online.
//
// Conflict resolution: last-write-wins by `client_updated_at` (epoch ms).
// On a NEW device the local meta timestamp is 0, so the cloud document always
// wins → automatic full restore on login from another device.
//
// Status exposed for the UI indicators:
//   "offline" | "syncing" | "synced" | "error" | "idle"
// ============================================================================

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "./store";

export type SyncStatus = "idle" | "offline" | "syncing" | "synced" | "error";

// State keys that represent USER DATA (everything except action functions).
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
  "focus",
  "notifPermission",
  "lastReminderAt",
  "settings",
  "mission",
  "subjectGoals",
  "weights",
  "weightGoal",
  "sleeps",
  "notifLog",
  "scheduled",
  "lastActiveAt",
  "cofrinho",
  "weekly",
] as const;

const META_KEY = "levelup-sync-meta";
const PUSH_DEBOUNCE_MS = 1500;

// ---- status broadcaster ----------------------------------------------------
let status: SyncStatus = "idle";
const listeners = new Set<(s: SyncStatus) => void>();

function setStatus(next: SyncStatus) {
  if (status === next) return;
  status = next;
  for (const fn of listeners) fn(next);
}

export function getSyncStatus(): SyncStatus {
  return status;
}

export function onSyncStatus(fn: (s: SyncStatus) => void): () => void {
  listeners.add(fn);
  fn(status);
  return () => {
    listeners.delete(fn);
  };
}

// ---- local meta (last local modification timestamp) ------------------------
function readLocalUpdatedAt(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(META_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as { localUpdatedAt?: number };
    return Number(parsed.localUpdatedAt) || 0;
  } catch {
    return 0;
  }
}

function writeLocalUpdatedAt(ts: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(META_KEY, JSON.stringify({ localUpdatedAt: ts }));
  } catch {
    /* ignore quota */
  }
}

// ---- engine internals ------------------------------------------------------
let userId: string | null = null;
let localUpdatedAt = 0;
let remoteUpdatedAt = 0;
let suppress = false; // true while applying remote state (avoid feedback loop)
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let started = false;

function snapshot(): Record<string, unknown> {
  const s = useStore.getState() as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of DATA_KEYS) out[k] = s[k];
  return out;
}

function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

function schedulePush() {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    void push();
  }, PUSH_DEBOUNCE_MS);
}

async function push(): Promise<void> {
  if (!userId) return;
  if (!isOnline()) {
    setStatus("offline");
    return;
  }
  setStatus("syncing");
  const ts = localUpdatedAt;
  const { error } = await supabase
    .from("user_state")
    .upsert(
      { user_id: userId, state: snapshot(), client_updated_at: ts },
      { onConflict: "user_id" },
    );
  if (error) {
    console.error("[sync] push failed", error.message);
    setStatus("error");
    return;
  }
  remoteUpdatedAt = ts;
  setStatus("synced");
}

/**
 * Reconcile local and remote on sign-in / reconnect.
 * Last-write-wins by client_updated_at.
 */
async function reconcile(): Promise<void> {
  if (!userId) return;
  if (!isOnline()) {
    setStatus("offline");
    return;
  }
  setStatus("syncing");
  const { data, error } = await supabase
    .from("user_state")
    .select("state, client_updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[sync] pull failed", error.message);
    setStatus("error");
    return;
  }

  if (!data) {
    // No cloud document yet → seed it with the local snapshot.
    if (localUpdatedAt === 0) {
      localUpdatedAt = Date.now();
      writeLocalUpdatedAt(localUpdatedAt);
    }
    await push();
    return;
  }

  const remoteTs = Number(data.client_updated_at) || 0;
  remoteUpdatedAt = remoteTs;

  if (remoteTs > localUpdatedAt) {
    // Cloud is newer → restore it locally (multi-device restore).
    suppress = true;
    try {
      useStore.setState((data.state ?? {}) as Record<string, never>);
    } finally {
      suppress = false;
    }
    localUpdatedAt = remoteTs;
    writeLocalUpdatedAt(localUpdatedAt);
    setStatus("synced");
  } else if (localUpdatedAt > remoteTs) {
    // Local has newer changes → push them up.
    await push();
  } else {
    setStatus("synced");
  }
}

/** Manual trigger usable from UI ("sincronizar agora"). */
export async function syncNow(): Promise<SyncStatus> {
  await reconcile();
  return status;
}

// ---- lifecycle -------------------------------------------------------------
export function initSync() {
  if (started || typeof window === "undefined") return;
  started = true;
  localUpdatedAt = readLocalUpdatedAt();

  // Track local data changes → bump timestamp + schedule a push.
  useStore.subscribe(() => {
    if (suppress) return;
    localUpdatedAt = Date.now();
    writeLocalUpdatedAt(localUpdatedAt);
    if (userId) {
      if (isOnline()) schedulePush();
      else setStatus("offline");
    }
  });

  // Auth changes drive pull/push.
  supabase.auth.getSession().then(({ data }) => {
    userId = data.session?.user?.id ?? null;
    if (userId) void reconcile();
    else setStatus(isOnline() ? "idle" : "offline");
  });

  supabase.auth.onAuthStateChange((event, session) => {
    const nextId = session?.user?.id ?? null;
    if (event === "SIGNED_OUT") {
      userId = null;
      setStatus(isOnline() ? "idle" : "offline");
      return;
    }
    if (nextId && nextId !== userId) {
      userId = nextId;
      void reconcile();
    } else if (nextId) {
      userId = nextId;
    }
  });

  // Network transitions.
  window.addEventListener("online", () => {
    if (userId) void reconcile();
    else setStatus("idle");
  });
  window.addEventListener("offline", () => {
    setStatus("offline");
  });

  // Flush pending changes before unload.
  window.addEventListener("beforeunload", () => {
    if (userId && localUpdatedAt > remoteUpdatedAt && isOnline()) void push();
  });
}

// ---- React hook ------------------------------------------------------------
export function useSyncStatus(): SyncStatus {
  const [s, setS] = useState<SyncStatus>(getSyncStatus());
  useEffect(() => onSyncStatus(setS), []);
  return s;
}
