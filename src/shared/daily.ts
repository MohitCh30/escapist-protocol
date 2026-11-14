export const SCENARIO_COUNT = 4;

export function todayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function dayNumberFor(firstDay: string, dayKey: string): number {
  const ms = Date.parse(dayKey) - Date.parse(firstDay);
  return Math.max(1, Math.floor(ms / 86400000) + 1);
}

export function yesterdayKey(dayKey: string): string {
  return new Date(Date.parse(dayKey) - 86400000).toISOString().slice(0, 10);
}

export function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function rngStream(seedString: string): () => number {
  let seed = hashString(seedString);
  return () => {
    seed = Math.imul(seed ^ (seed >>> 15), seed | 1) >>> 0;
    seed ^= (seed + Math.imul(seed ^ (seed >>> 7), seed | 61)) >>> 0;
    return ((seed ^ (seed >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleForDay(dayKey: string, count: number): number[] {
  const next = rngStream(dayKey);
  return Array.from({ length: count }, (_, i) => ({ i, r: next() }))
    .sort((a, b) => a.r - b.r)
    .map((entry) => entry.i);
}
