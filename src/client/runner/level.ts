import { rngStream } from '../../shared/daily';

export type Rect = { x: number; y: number; w: number; h: number };

export type DroneDef = {
  x0: number;
  x1: number;
  y: number;
  speed: number;
  coneHalf: number;
};

export type ChunkDef = {
  id: string;
  length: number;
  floorGaps: { x: number; w: number }[];
  platforms: Rect[];
  hazards: Rect[];
  drones: DroneDef[];
  pillars: Rect[];
};

export type SegmentLevel = {
  length: number;
  floors: Rect[];
  platforms: Rect[];
  hazards: Rect[];
  drones: DroneDef[];
  pillars: Rect[];
  npcX: number;
};

export const FLOOR_Y = 560;

const CHUNK_LIBRARY: ChunkDef[] = [
  {
    id: 'pit-hop',
    length: 760,
    floorGaps: [{ x: 280, w: 150 }],
    platforms: [{ x: 285, y: 510, w: 140, h: 18 }],
    hazards: [],
    drones: [{ x0: 480, x1: 700, y: 340, speed: 100, coneHalf: 65 }],
    pillars: [],
  },
  {
    id: 'stairwell',
    length: 720,
    floorGaps: [],
    platforms: [
      { x: 180, y: 470, w: 140, h: 18 },
      { x: 380, y: 380, w: 140, h: 18 },
      { x: 540, y: 478, w: 150, h: 18 },
    ],
    hazards: [{ x: 340, y: 544, w: 34, h: 16 }],
    drones: [{ x0: 60, x1: 320, y: 300, speed: 100, coneHalf: 62 }],
    pillars: [{ x: 560, y: 450, w: 36, h: 110 }],
  },
  {
    id: 'sweep',
    length: 800,
    floorGaps: [],
    platforms: [],
    hazards: [],
    drones: [
      { x0: 100, x1: 420, y: 330, speed: 100, coneHalf: 65 },
      { x0: 430, x1: 760, y: 330, speed: 130, coneHalf: 62 },
    ],
    pillars: [
      { x: 210, y: 450, w: 40, h: 110 },
      { x: 560, y: 450, w: 40, h: 110 },
    ],
  },
  {
    id: 'catwalk',
    length: 780,
    floorGaps: [
      { x: 240, w: 140 },
      { x: 520, w: 140 },
    ],
    platforms: [
      { x: 252, y: 520, w: 170, h: 16 },
      { x: 532, y: 520, w: 170, h: 16 },
    ],
    hazards: [],
    drones: [{ x0: 260, x1: 650, y: 300, speed: 105, coneHalf: 65 }],
    pillars: [],
  },
  {
    id: 'shock-panels',
    length: 740,
    floorGaps: [],
    platforms: [{ x: 420, y: 430, w: 180, h: 16 }],
    hazards: [
      { x: 220, y: 544, w: 60, h: 16 },
      { x: 360, y: 544, w: 60, h: 16 },
      { x: 620, y: 544, w: 60, h: 16 },
    ],
    drones: [{ x0: 180, x1: 560, y: 300, speed: 105, coneHalf: 60 }],
    pillars: [{ x: 660, y: 450, w: 36, h: 110 }],
  },
  {
    id: 'double-jump',
    length: 800,
    floorGaps: [
      { x: 200, w: 140 },
      { x: 480, w: 140 },
    ],
    platforms: [
      { x: 200, y: 520, w: 180, h: 16 },
      { x: 480, y: 520, w: 180, h: 16 },
    ],
    hazards: [],
    drones: [{ x0: 380, x1: 720, y: 280, speed: 130, coneHalf: 62 }],
    pillars: [],
  },
  {
    id: 'gauntlet',
    length: 780,
    floorGaps: [],
    platforms: [],
    hazards: [{ x: 500, y: 544, w: 40, h: 16 }],
    drones: [
      { x0: 60, x1: 300, y: 320, speed: 130, coneHalf: 60 },
      { x0: 300, x1: 560, y: 320, speed: 130, coneHalf: 60 },
      { x0: 560, x1: 760, y: 320, speed: 130, coneHalf: 60 },
    ],
    pillars: [
      { x: 300, y: 450, w: 30, h: 110 },
      { x: 560, y: 450, w: 30, h: 110 },
    ],
  },
];

export function buildSegment(dayKey: string, slot: number): SegmentLevel {
  const rng = rngStream(`${dayKey}:segment:${slot}`);
  const ids = CHUNK_LIBRARY.map((c) => c.id);
  const picked: ChunkDef[] = [];
  while (picked.length < 2) {
    const idx = Math.floor(rng() * ids.length);
    const candidate = CHUNK_LIBRARY[idx];
    if (!candidate) continue;
    if (picked.some((c) => c.id === candidate.id)) continue;
    picked.push(candidate);
  }

  const ENCOUNTER_LENGTH = 560;
  let cursor = 0;
  const floors: Rect[] = [];
  const platforms: Rect[] = [];
  const hazards: Rect[] = [];
  const drones: DroneDef[] = [];
  const pillars: Rect[] = [];

  for (const chunk of picked) {
    const chunkFloorSegs: Rect[] = [];
    const sortedGaps = [...chunk.floorGaps].sort((a, b) => a.x - b.x);
    let coverCursor = 0;
    for (const gap of sortedGaps) {
      if (gap.x > coverCursor) {
        chunkFloorSegs.push({
          x: cursor + coverCursor,
          y: FLOOR_Y,
          w: gap.x - coverCursor,
          h: 160,
        });
      }
      coverCursor = gap.x + gap.w;
    }
    if (coverCursor < chunk.length) {
      chunkFloorSegs.push({ x: cursor + coverCursor, y: FLOOR_Y, w: chunk.length - coverCursor, h: 160 });
    }
    floors.push(...chunkFloorSegs);

    platforms.push(...chunk.platforms.map((p) => ({ ...p, x: p.x + cursor })));
    hazards.push(...chunk.hazards.map((h2) => ({ ...h2, x: h2.x + cursor })));
    pillars.push(...chunk.pillars.map((p) => ({ ...p, x: p.x + cursor })));
    drones.push(...chunk.drones.map((d) => ({ ...d, x0: d.x0 + cursor, x1: d.x1 + cursor })));

    cursor += chunk.length;
  }

  floors.push({ x: cursor, y: FLOOR_Y, w: ENCOUNTER_LENGTH, h: 160 });
  const npcX = cursor + ENCOUNTER_LENGTH - 140;
  cursor += ENCOUNTER_LENGTH;

  return {
    length: cursor,
    floors,
    platforms,
    hazards,
    drones,
    pillars,
    npcX,
  };
}
