import { test } from 'node:test';
import assert from 'node:assert';
import { buildSegment, FLOOR_Y, type SegmentLevel } from '../src/client/runner/level';
import { todayKey } from '../src/shared/daily';

type Surface = { x0: number; x1: number; topY: number };

type SlotResult = {
  timeMs: number;
  falls: number;
  alarms: number;
  subjugations: number;
  completed: boolean;
};

const DT = 1 / 120;
const GRAV = 1200;
const BASE_RUN = 260;
const JUMP_V = -600;
const HERO_CHOICE_PENALTY_MS = 3000;
const ALARM_PENALTY_MS = 3000;
const SUBJUGATE_PENALTY_MS = 10000;
const ALERT_RATE = 65;
const ALERT_DECAY = 28;

function surfacesFor(level: SegmentLevel): Surface[] {
  const out: Surface[] = [];
  for (const f of level.floors) out.push({ x0: f.x, x1: f.x + f.w, topY: FLOOR_Y });
  for (const p of level.platforms) out.push({ x0: p.x, x1: p.x + p.w, topY: p.y });
  for (const p of level.pillars) out.push({ x0: p.x, x1: p.x + p.w, topY: p.y });
  return out;
}

function wallAhead(level: SegmentLevel, x: number, y: number): number {
  let dist = Infinity;
  for (const p of level.pillars) {
    if (p.y <= y + 60) continue;
    if (p.x > x - 4 && p.x - x < dist) dist = p.x - x;
  }
  return dist;
}

function holeAhead(level: SegmentLevel, x: number): number {
  for (let scan = x; scan < Math.min(x + 220, level.length); scan += 4) {
    const hasFloor = level.floors.some((f) => scan >= f.x && scan <= f.x + f.w);
    if (!hasFloor) return scan - x;
  }
  return Infinity;
}

function simulateSlot(dayKey: string, slot: number, speedMult: number, alertMult: number): SlotResult {
  const level = buildSegment(dayKey, slot);
  const surfaces = surfacesFor(level);
  const RUN = BASE_RUN * speedMult;

  let x = 80;
  let y = FLOOR_Y - 40;
  let vy = 0;
  let grounded = true;
  let hiding = false;
  let falls = 0;
  let alarms = 0;
  let subjugations = 0;
  let elapsed = 0;
  let alert = 0;
  let grace = 0;

  const droneX = level.drones.map((d) => d.x0);
  const droneDir = level.drones.map(() => 1);

  for (let step = 0; step < 120 * 240; step++) {
    elapsed += DT * 1000;
    if (grace > 0) grace -= DT * 1000;

    for (let i = 0; i < level.drones.length; i++) {
      const def = level.drones[i];
      if (!def) continue;
      const nx = (droneX[i] ?? 0) + (droneDir[i] ?? 1) * def.speed * DT;
      droneX[i] = nx;
      if (nx > def.x1) {
        droneX[i] = def.x1;
        droneDir[i] = -1;
      } else if (nx < def.x0) {
        droneX[i] = def.x0;
        droneDir[i] = 1;
      }
    }

    const threat = level.drones.some((d, i) => {
      const dx = (droneX[i] ?? 0) - x;
      return Math.abs(dx) < d.coneHalf + 40;
    });
    const clearAhead = level.drones.every((d, i) => {
      const dx = (droneX[i] ?? 0) - x;
      return dx < -(d.coneHalf + 10) || Math.abs(dx) > d.coneHalf + 55;
    });

    const gapDist = holeAhead(level, x + 6);
    const hazard = level.hazards.find((h) => h.x + h.w > x && h.x - x < 150);
    const hazardDist = hazard ? hazard.x - x : Infinity;
    const wallDist = grounded ? wallAhead(level, x + 14, y) : Infinity;

    if (!hiding && threat && grounded) {
      const inConeNow = level.drones.some((d, i) => Math.abs(x - (droneX[i] ?? 0)) < d.coneHalf);
      if (!inConeNow) hiding = true;
    }
    if (hiding && (clearAhead || !threat)) hiding = false;

    if (grounded && !hiding && (gapDist < 125 || hazardDist < 115 || wallDist < 130)) {
      vy = JUMP_V;
      grounded = false;
    }

    const moving = !hiding;
    if (!grounded) {
      const prevY = y;
      vy += GRAV * DT;
      y += vy * DT;
      x += RUN * DT;

      const landing = surfaces
        .filter((s) => x >= s.x0 && x <= s.x1 && prevY <= s.topY && y >= s.topY)
        .sort((a, b) => a.topY - b.topY)[0];

      if (vy > 0 && landing) {
        y = landing.topY - 2;
        vy = 0;
        grounded = true;
      }

      if (y > FLOOR_Y + 160) {
        falls += 1;
        x = Math.max(40, x - 260);
        y = FLOOR_Y - 40;
        vy = 0;
        grounded = true;
        grace = 1500;
        elapsed += 2000;
      }
    } else {
      if (moving) x += RUN * DT;
      const below = surfaces
        .filter((s) => x + 4 >= s.x0 && x + 4 <= s.x1 && s.topY >= y - 4)
        .sort((a, b) => a.topY - b.topY)[0];
      if (!below) {
        grounded = false;
        vy = 0;
      } else if (below.topY > y) {
        y = below.topY;
      }
    }

    const detected = level.drones.some(
      (d, i) =>
        Math.abs(x - (droneX[i] ?? 0)) < d.coneHalf && y > d.y && y < FLOOR_Y + 20,
    );

    if (grace > 0) {
      // unchanged during grace
    } else if (detected && moving && grounded) {
      alert += ALERT_RATE * alertMult * DT;
      if (alert >= 100) {
        alert = 0;
        alarms += 1;
        grace = 1200;
        elapsed += ALARM_PENALTY_MS;
        if (alarms % 2 === 0) {
          subjugations += 1;
          x = 60;
          y = FLOOR_Y - 60;
          elapsed += SUBJUGATE_PENALTY_MS;
          grace = 2500;
          alert = 0;
        }
      }
    } else {
      alert = Math.max(0, alert - ALERT_DECAY * DT);
    }

    if (x >= level.npcX) {
      return { timeMs: elapsed, falls, alarms, subjugations, completed: true };
    }
  }
  return { timeMs: elapsed, falls, alarms, subjugations, completed: false };
}

type DayRun = {
  dayKey: string;
  totalMs: number;
  falls: number;
  alarms: number;
  subjugations: number;
  completed: boolean;
};

type Strategy = 'hero' | 'ruthless';

function simulateDay(dayKey: string, strategy: Strategy): DayRun {
  let totalMs = 0;
  let falls = 0;
  let alarms = 0;
  let subjugations = 0;
  let completed = true;
  let speedMult = 1;
  let alertMult = 1;

  for (let slot = 0; slot < 4; slot++) {
    const r = simulateSlot(dayKey, slot, speedMult, alertMult);
    totalMs += r.timeMs;
    falls += r.falls;
    alarms += r.alarms;
    subjugations += r.subjugations;
    if (!r.completed) completed = false;

    if (strategy === 'hero') {
      totalMs += HERO_CHOICE_PENALTY_MS;
      speedMult = 0.9;
      alertMult = 1.4;
    } else {
      speedMult = 1.08;
      alertMult = 0.8;
    }
  }
  return { dayKey, totalMs, falls, alarms, subjugations, completed };
}

function fmt(ms: number): string {
  const s = ms / 1000;
  return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}.${Math.floor((s % 1) * 10)}`;
}

function summarize(label: string, runs: DayRun[]) {
  const times = runs.map((r) => r.totalMs).sort((a, b) => a - b);
  const subjs = runs.map((r) => r.subjugations).sort((a, b) => a - b);
  const alarms = runs.map((r) => r.alarms).sort((a, b) => a - b);
  const idx = (arr: number[], p: number) => arr[Math.min(arr.length - 1, Math.floor(arr.length * p))] ?? 0;
  console.log(`${label}: p10=${fmt(idx(times, 0.1))} median=${fmt(idx(times, 0.5))} p90=${fmt(idx(times, 0.9))}`);
  console.log(`  alarms median=${idx(alarms, 0.5)} p90=${idx(alarms, 0.9)} · subjugations median=${idx(subjs, 0.5)} p90=${idx(subjs, 0.9)}`);
}

test('bot completes every day for the next 60 days — hero & ruthless', () => {
  const start = new Date(`${todayKey()}T00:00:00Z`).getTime();
  const failures: string[] = [];
  const heroRuns: DayRun[] = [];
  const ruthlessRuns: DayRun[] = [];

  for (let d = 0; d < 60; d++) {
    const dayKey = new Date(start + d * 86400000).toISOString().slice(0, 10);
    const hero = simulateDay(dayKey, 'hero');
    const ruthless = simulateDay(dayKey, 'ruthless');
    heroRuns.push(hero);
    ruthlessRuns.push(ruthless);
    if (!hero.completed || hero.falls > 0) failures.push(`${dayKey} hero falls=${hero.falls}`);
    if (!ruthless.completed || ruthless.falls > 0) failures.push(`${dayKey} ruthless falls=${ruthless.falls}`);
  }

  console.log('\n==== FULL-GAME LOOP REPORT (alert-wound model, 60 days) ====');
  console.log(`failures: ${failures.length}`);
  summarize('hero (rescue everyone)', heroRuns);
  summarize('ruthless (sacrifice everyone)', ruthlessRuns);
  const med = (arr: number[]) => arr.sort((a, b) => a - b)[Math.floor(arr.length / 2)] ?? 0;
  const heroMed = med(heroRuns.map((r) => r.totalMs));
  const ruthMed = med(ruthlessRuns.map((r) => r.totalMs));
  console.log(`leaderboard tension: ruthless median is ${fmt(Math.abs(heroMed - ruthMed))} faster than hero`);
  assert.strictEqual(failures.length, 0, failures.join(' | '));
});
