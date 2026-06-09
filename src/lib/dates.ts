export function todayKey(d: Date = new Date()): string {
  // Local YYYY-MM-DD
  return d.toLocaleDateString("en-CA");
}

export function nowMinutes(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

export function timeToMinutes(time: string): number {
  if (!time) return 24 * 60;
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function formatHours(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h <= 0) return `${m}min`;
  return `${h}h ${m}min`;
}

export function daysBetween(fromKey: string, to: Date = new Date()): number {
  const from = new Date(fromKey + "T00:00:00");
  const toMid = new Date(to.toLocaleDateString("en-CA") + "T00:00:00");
  return Math.max(0, Math.round((toMid.getTime() - from.getTime()) / 86400000));
}

export function startOfWeekKey(d: Date = new Date()): string {
  const day = d.getDay(); // 0 sun
  const diff = (day + 6) % 7; // monday start
  const monday = new Date(d);
  monday.setDate(d.getDate() - diff);
  return todayKey(monday);
}

/** End of the current week (Sunday) as a date key. */
export function endOfWeekKey(d: Date = new Date()): string {
  const monday = new Date(startOfWeekKey(d) + "T00:00:00");
  monday.setDate(monday.getDate() + 6);
  return todayKey(monday);
}

/** Add n days to a date key, returning a date key. */
export function addDaysKey(key: string, n: number): string {
  const d = new Date(key + "T00:00:00");
  d.setDate(d.getDate() + n);
  return todayKey(d);
}

/** Signed number of days from today until the given date key (can be negative). */
export function daysUntil(toKey: string): number {
  const today = new Date(todayKey() + "T00:00:00");
  const to = new Date(toKey + "T00:00:00");
  return Math.round((to.getTime() - today.getTime()) / 86400000);
}

export const WEEKDAYS = ["S", "T", "Q", "Q", "S", "S", "D"]; // mon..sun
