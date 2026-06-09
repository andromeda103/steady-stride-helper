// ============================================================================
// Persistence abstraction — prepares the app for future cloud sync.
//
// Today: all state is persisted locally (zustand `persist` -> localStorage).
// This module provides a single storage adapter + a sync coordinator so that a
// future cloud backend (e.g. Lovable Cloud / Supabase) and Capacitor native
// storage (@capacitor/preferences) can be plugged in WITHOUT touching feature
// code or the store shape.
//
// Sync status is exposed for the UI indicators: "sincronizando", "sincronizado",
// "erro" — see SyncStatus below.
// ============================================================================

import { isNativePlatform } from "./platform";

export type SyncStatus = "idle" | "syncing" | "synced" | "error";

// --- Storage adapter --------------------------------------------------------
// A zustand-compatible StateStorage. Web uses localStorage. When wrapped with
// Capacitor, swap the implementation to @capacitor/preferences (async-capable).

export interface KeyValueStorage {
  getItem: (key: string) => string | null | Promise<string | null>;
  setItem: (key: string, value: string) => void | Promise<void>;
  removeItem: (key: string) => void | Promise<void>;
}

const memoryStore = new Map<string, string>();

const webStorage: KeyValueStorage = {
  getItem: (key) => {
    if (typeof window === "undefined") return memoryStore.get(key) ?? null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return memoryStore.get(key) ?? null;
    }
  },
  setItem: (key, value) => {
    memoryStore.set(key, value);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* quota / private mode — memory fallback already set */
    }
  },
  removeItem: (key) => {
    memoryStore.delete(key);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

/**
 * Returns the active local storage adapter.
 * Web -> localStorage. Native -> still localStorage inside the WebView today;
 * replace with @capacitor/preferences here when migrating for extra durability.
 */
export function getStorage(): KeyValueStorage {
  // Placeholder branch kept intentionally so the native swap is a one-line change.
  if (isNativePlatform()) return webStorage;
  return webStorage;
}

// --- Sync coordinator (scaffolding) -----------------------------------------
// No remote backend is wired yet. This gives the app a stable API + status so
// UI sync indicators work now and a real cloud push/pull can be dropped in
// later without changing callers.

type Listener = (status: SyncStatus) => void;

let currentStatus: SyncStatus = "idle";
const listeners = new Set<Listener>();

export function getSyncStatus(): SyncStatus {
  return currentStatus;
}

export function onSyncStatus(fn: Listener): () => void {
  listeners.add(fn);
  fn(currentStatus);
  return () => listeners.delete(fn);
}

function setSyncStatus(status: SyncStatus) {
  currentStatus = status;
  for (const fn of listeners) fn(status);
}

/**
 * Future hook for cloud sync. Currently a local no-op that just flips the
 * status so the UI indicators are exercised. Replace the body with a real
 * push/pull against the cloud backend when available.
 */
export async function syncNow(): Promise<SyncStatus> {
  try {
    setSyncStatus("syncing");
    // TODO(cloud): push local snapshot + pull remote, then merge.
    await Promise.resolve();
    setSyncStatus("synced");
    return "synced";
  } catch {
    setSyncStatus("error");
    return "error";
  }
}
