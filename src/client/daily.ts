import type { DailyInitResponse, DailyResult, DailySubmitResponse } from '../shared/api';
import { SCENARIO_COUNT } from '../shared/daily';

export const dailyState = {
  info: null as DailyInitResponse | null,
  submit: null as DailySubmitResponse | null,
  offline: false,
};

export function scenarioIndexAt(slot: number): number {
  const order = dailyState.info?.order;
  const idx = order?.[slot];
  if (typeof idx === 'number' && idx >= 0 && idx < SCENARIO_COUNT) return idx;
  return slot % SCENARIO_COUNT;
}

function isDailyInit(x: unknown): x is DailyInitResponse {
  if (typeof x !== 'object' || x === null) return false;
  if (!('order' in x) || !('dayNumber' in x) || !('dayKey' in x) || !('username' in x)) return false;
  return (
    Array.isArray(x.order) &&
    typeof x.dayNumber === 'number' &&
    typeof x.dayKey === 'string' &&
    typeof x.username === 'string'
  );
}

function isDailySubmit(x: unknown): x is DailySubmitResponse {
  if (typeof x !== 'object' || x === null) return false;
  if (!('rank' in x) || !('aggregate' in x) || !('dayNumber' in x)) return false;
  return typeof x.rank === 'number' && typeof x.dayNumber === 'number' && typeof x.aggregate === 'object';
}

export async function fetchDailyInit(): Promise<void> {
  try {
    const res = await fetch('/api/daily/init', { credentials: 'include' });
    if (!res.ok) throw new Error(`init ${res.status}`);
    const data: unknown = await res.json();
    if (isDailyInit(data)) {
      dailyState.info = data;
      dailyState.offline = false;
      return;
    }
    throw new Error('bad init shape');
  } catch {
    dailyState.info = null;
    dailyState.offline = true;
  }
}

export async function submitDailyResult(result: DailyResult): Promise<void> {
  dailyState.submit = null;
  if (dailyState.offline) return;
  try {
    const res = await fetch('/api/daily/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ result }),
    });
    if (!res.ok) throw new Error(`submit ${res.status}`);
    const data: unknown = await res.json();
    if (isDailySubmit(data)) dailyState.submit = data;
  } catch {
    dailyState.submit = null;
  }
}

export type TopEntry = {
  rank: number;
  username: string;
  timeMs: number;
  saved: number;
  ending: 'hero' | 'neutral' | 'outcast' | string;
};

export async function fetchLeaderboard(): Promise<{ playersToday: number; top: TopEntry[] } | null> {
  if (dailyState.offline) return null;
  try {
    const res = await fetch('/api/daily/leaderboard', { credentials: 'include' });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    if (typeof data === 'object' && data !== null && 'top' in data && Array.isArray(data.top)) {
      return {
        playersToday:
          'playersToday' in data && typeof data.playersToday === 'number' ? data.playersToday : 0,
        top: data.top as TopEntry[],
      };
    }
  } catch {
    // noop
  }
  return null;
}

export async function shareResult(text: string): Promise<boolean> {
  if (dailyState.offline) return false;
  try {
    const res = await fetch('/api/daily/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return false;
    const data: unknown = await res.json();
    return (
      typeof data === 'object' &&
      data !== null &&
      'success' in data &&
      data.success === true
    );
  } catch {
    return false;
  }
}
