import { Hono } from 'hono';
import { context, redis, reddit } from '@devvit/web/server';
import type {
  AggregateStats,
  DailyInitResponse,
  DailyResult,
  DailySubmitResponse,
  EndingId,
  ErrorResponse,
  ShareResponse,
} from '../../shared/api';
import { SCENARIO_COUNT, dayNumberFor, shuffleForDay, todayKey, yesterdayKey } from '../../shared/daily';

const NPC_KEYS = ['prisha', 'advik', 'tanya', 'chaps'] as const;

const K = {
  firstDay: 'lockdown:firstDay',
  board: (day: string) => `lockdown:day:${day}:board`,
  agg: (day: string) => `lockdown:day:${day}:agg`,
  result: (day: string, user: string) => `lockdown:day:${day}:player:${user}`,
  streak: (user: string) => `lockdown:user:${user}:streak`,
  lastPlayed: (user: string) => `lockdown:user:${user}:lastPlayed`,
};

type BoardEntry = {
  score: number;
  saved: number;
  timeMs: number;
  ending: EndingId;
  username: string;
  ts: number;
};

async function ensureFirstDay(dayKey: string): Promise<string> {
  const existing = await redis.get(K.firstDay);
  if (existing) return existing;
  await redis.set(K.firstDay, dayKey);
  return dayKey;
}

function parseResult(raw: string | undefined): DailyResult | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    if (!('score' in parsed) || !('endingId' in parsed) || !('choices' in parsed)) return null;
    if (typeof parsed.score !== 'number' || !Array.isArray(parsed.choices)) return null;
    return parsed as DailyResult;
  } catch {
    return null;
  }
}

async function aggregateFor(dayKey: string): Promise<AggregateStats> {
  const agg = await redis.hGetAll(K.agg(dayKey)).catch(() => ({} as Record<string, string>));
  const num = (k: string): number => parseInt(agg[k] ?? '0', 10) || 0;
  return {
    playersToday: num('players'),
    endings: { hero: num('hero'), neutral: num('neutral'), outcast: num('outcast') },
    npcBreakdown: NPC_KEYS.map((npc) => ({
      npc,
      rescue: num(`npc:${npc}:r`),
      neutral: num(`npc:${npc}:n`),
      sacrifice: num(`npc:${npc}:s`),
    })),
  };
}

async function rankFor(dayKey: string, username: string): Promise<number> {
  const board = await redis.hGetAll(K.board(dayKey)).catch(() => ({} as Record<string, string>));
  const entries: BoardEntry[] = [];
  for (const raw of Object.values(board)) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null && 'score' in parsed && 'ts' in parsed) {
        entries.push(parsed as BoardEntry);
      }
    } catch {
      continue;
    }
  }
  entries.sort((a, b) => a.timeMs - b.timeMs || b.saved - a.saved || a.ts - b.ts);
  const idx = entries.findIndex((e) => e.username === username);
  return idx === -1 ? entries.length + 1 : idx + 1;
}

export const daily = new Hono();

daily.get('/leaderboard', async (c) => {
  const { postId } = context;
  if (!postId) {
    return c.json<ErrorResponse>({ status: 'error', message: 'postId is required' }, 400);
  }
  try {
    const dayKey = todayKey();
    const board = await redis.hGetAll(K.board(dayKey)).catch(() => ({} as Record<string, string>));
    const entries: BoardEntry[] = [];
    for (const raw of Object.values(board)) {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed === 'object' && parsed !== null && 'timeMs' in parsed && 'username' in parsed) {
          entries.push(parsed as BoardEntry);
        }
      } catch {
        continue;
      }
    }
    entries.sort((a, b) => a.timeMs - b.timeMs || b.saved - a.saved || a.ts - b.ts);
    const top = entries.slice(0, 5).map((e, i) => ({
      rank: i + 1,
      username: e.username,
      timeMs: e.timeMs,
      saved: e.saved,
      ending: e.ending,
    }));
    return c.json({ type: 'leaderboard', dayKey, playersToday: entries.length, top });
  } catch (error) {
    return c.json<ErrorResponse>(
      { status: 'error', message: error instanceof Error ? error.message : 'unknown' },
      500,
    );
  }
});

daily.get('/init', async (c) => {
  const { postId } = context;
  if (!postId) {
    return c.json<ErrorResponse>({ status: 'error', message: 'postId is required' }, 400);
  }

  try {
    const username = (await reddit.getCurrentUsername()) ?? 'anonymous';
    const dayKey = todayKey();
    const firstDay = await ensureFirstDay(dayKey);
    const order = shuffleForDay(dayKey, SCENARIO_COUNT);

    const [existing, streakRaw] = await Promise.all([
      redis.get(K.result(dayKey, username)),
      redis.get(K.streak(username)),
    ]);

    return c.json<DailyInitResponse>({
      type: 'daily-init',
      dayKey,
      dayNumber: dayNumberFor(firstDay, dayKey),
      username,
      order,
      alreadyPlayed: existing != null,
      previousResult: parseResult(existing),
      streak: parseInt(streakRaw ?? '0', 10) || 0,
    });
  } catch (error) {
    console.error('daily init error', error);
    return c.json<ErrorResponse>(
      { status: 'error', message: error instanceof Error ? error.message : 'unknown' },
      500,
    );
  }
});

daily.post('/submit', async (c) => {
  const { postId } = context;
  if (!postId) {
    return c.json<ErrorResponse>({ status: 'error', message: 'postId is required' }, 400);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json<ErrorResponse>({ status: 'error', message: 'invalid json' }, 400);
  }
  if (typeof body !== 'object' || body === null || !('result' in body)) {
    return c.json<ErrorResponse>({ status: 'error', message: 'missing result' }, 400);
  }
  const result = (body as { result: DailyResult }).result;
  if (
    typeof result !== 'object' ||
    result === null ||
    typeof result.score !== 'number' ||
    !Array.isArray(result.choices)
  ) {
    return c.json<ErrorResponse>({ status: 'error', message: 'invalid result' }, 400);
  }

  try {
    const username = (await reddit.getCurrentUsername()) ?? 'anonymous';
    const dayKey = todayKey();
    const firstDay = await ensureFirstDay(dayKey);
    const dayNumber = dayNumberFor(firstDay, dayKey);

    const alreadySubmitted = await redis.get(K.result(dayKey, username));

    if (alreadySubmitted == null) {
      const entry: BoardEntry = {
        score: result.score,
        saved: result.saved,
        timeMs: typeof result.timeMs === 'number' ? result.timeMs : Number.MAX_SAFE_INTEGER,
        ending: result.endingId,
        username,
        ts: Date.now(),
      };
      await redis.hSet(K.board(dayKey), { [username]: JSON.stringify(entry) });
      await redis.set(K.result(dayKey, username), JSON.stringify(result));

      await redis.hSet(K.agg(dayKey), { players: '0' });
      await redis.hIncrBy(K.agg(dayKey), 'players', 1);
      await redis.hIncrBy(K.agg(dayKey), result.endingId, 1);
      for (const choice of result.choices) {
        const field = choice.value > 0 ? 'r' : choice.value < 0 ? 's' : 'n';
        await redis.hIncrBy(K.agg(dayKey), `npc:${choice.npc}:${field}`, 1);
      }
    }

    const [lastPlayed, streakRaw] = await Promise.all([
      redis.get(K.lastPlayed(username)),
      redis.get(K.streak(username)),
    ]);
    const currentStreak = parseInt(streakRaw ?? '0', 10) || 0;

    let newStreak = currentStreak;
    if (alreadySubmitted == null) {
      newStreak = lastPlayed === yesterdayKey(dayKey) ? currentStreak + 1 : 1;
      await Promise.all([
        redis.set(K.streak(username), String(newStreak)),
        redis.set(K.lastPlayed(username), dayKey),
      ]);
    }

    const [rank, aggregate] = await Promise.all([
      rankFor(dayKey, username),
      aggregateFor(dayKey),
    ]);

    return c.json<DailySubmitResponse>({
      type: 'daily-submit',
      dayKey,
      dayNumber,
      rank,
      playersToday: aggregate.playersToday,
      streak: newStreak,
      aggregate,
    });
  } catch (error) {
    console.error('daily submit error', error);
    return c.json<ErrorResponse>(
      { status: 'error', message: error instanceof Error ? error.message : 'unknown' },
      500,
    );
  }
});

daily.post('/share', async (c) => {
  const { postId } = context;
  if (!postId) {
    return c.json<ShareResponse>({ success: false, message: 'no post context' });
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json<ShareResponse>({ success: false, message: 'invalid json' });
  }
  if (typeof body !== 'object' || body === null || !('text' in body)) {
    return c.json<ShareResponse>({ success: false, message: 'missing text' });
  }
  const text = (body as { text: string }).text;
  if (typeof text !== 'string' || text.length < 10) {
    return c.json<ShareResponse>({ success: false, message: 'invalid text' });
  }

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const retryDelayMs = (error: unknown): number => {
    if (typeof error !== 'object' || error === null) return 6500;
    if (!('details' in error)) return 6500;
    const details = error.details;
    if (typeof details !== 'string') return 6500;
    const match = /TimeString="(\d+)\s*seconds?"/.exec(details);
    if (!match || !match[1]) return 6500;
    return (parseInt(match[1], 10) + 1.5) * 1000;
  };

  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await reddit.submitComment({ id: postId, text });
      return c.json<ShareResponse>({ success: true, message: 'posted' });
    } catch (error) {
      lastError = error;
      if (attempt < 2) await sleep(retryDelayMs(error));
    }
  }
  console.error('share error after retries', lastError);
  return c.json<ShareResponse>({
    success: false,
    message: lastError instanceof Error ? lastError.message : 'comment failed',
  });
});
