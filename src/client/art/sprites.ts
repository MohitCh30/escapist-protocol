import type Phaser from 'phaser';

type Palette = Record<string, number>;

export function paintTexture(
  scene: Phaser.Scene,
  key: string,
  rows: string[],
  palette: Palette,
): void {
  if (scene.textures.exists(key)) return;
  const width = Math.max(...rows.map((r) => r.length), 1);
  const height = rows.length;
  const g = scene.make.graphics({ x: 0, y: 0 });
  for (let yy = 0; yy < height; yy++) {
    const row = rows[yy] ?? '';
    for (let xx = 0; xx < width; xx++) {
      const ch = row[xx] ?? '.';
      if (ch === '.') continue;
      const color = palette[ch];
      if (color === undefined) continue;
      g.fillStyle(color, 1);
      g.fillRect(xx, yy, 1, 1);
    }
  }
  g.generateTexture(key, width, height);
  g.destroy();
}

const PLAYER_PALETTE: Palette = {
  '#': 0x0a2b27,
  B: 0x22ffe0,
  W: 0xbfffee,
  D: 0x0e8b7d,
  Y: 0xffd447,
};

const PLAYER_STAND = [
  '.....#####......',
  '....#WWWWW#.....',
  '...#WWBBBWW#....',
  '...#WBBBBBW#....',
  '....#DDDDD#.....',
  '....######B####.',
  '..#BBBBBBBBBBB#.',
  '.#BBB####BBB#Y#.',
  '.#BBB...#BBB.#..',
  '...BBB..BBBB....',
  '....#BBBBBB#....',
  '.....#BBB#......',
  '.....BB.BB......',
  '.....BB.BB......',
  '....BBB.BBB.....',
  '................',
];

const legs = (l12: string, l13: string, l14: string): string[] => {
  const base = [...PLAYER_STAND];
  base[11] = l12;
  base[12] = l13;
  base[13] = l14;
  return base;
};

const PLAYER_RUN0 = legs('.....#BBB#......', '....BB....BB....', '...BB......BB...');
const PLAYER_RUN1 = legs('.....#BBB#......', '......BBBB......', '.....BB..BB.....');

const PLAYER_CROUCH = [
  '................',
  '................',
  '....#WWWWW#....',
  '...#WWBBBWW#...',
  '...#WBBBBBW#...',
  '....#DDDDD#...',
  '..#BBBBBBBBB#.',
  '.#BBB####BBB#Y#',
  '.#BBB...#BBB..',
  '...BBBBBBBB#..',
  '.....######...',
];

const DRONE_PALETTE: Palette = {
  '#': 0x200b0f,
  R: 0xff3344,
  E: 0xffd0d0,
  W: 0xffffff,
  K: 0x444a5c,
};

const DRONE_A = [
  '.....KK..KK.....',
  '..############..',
  '.#RRRRRRRRRRR#.',
  '#RRWWEEEEWWWRR#',
  '#RREEEEEEEEERR#',
  '.#RRRRRRRRRRR#.',
  '..###########...',
];

const DRONE_B = [
  '.KK....KK....KK.',
  '..############..',
  '.#RRRRRRRRRRR#.',
  '#RRWWEEEEWWWRR#',
  '#RREEEEEEEEERR#',
  '.#RRRRRRRRRRR#.',
  '..###########...',
];

const HAZARD_STRIPE = ['RKRKRKRK', 'KRKRKRKR', 'RKRKRKRK', 'KRKRKRKR'];
const HAZARD_PALETTE: Palette = { R: 0xff3344, K: 0x220806 };

export type Emotion = 'neutral' | 'scared' | 'happy' | 'sad' | 'doomed';

const NPC_SPECS: Record<string, { robe: number; robeDark: number; skin: number; hair: number }> = {
  prisha: { robe: 0xff7fa5, robeDark: 0xa64b6c, skin: 0xffd9c0, hair: 0x3a2030 },
  advik: { robe: 0x5f8cff, robeDark: 0x34479e, skin: 0xd9b08c, hair: 0x1a120c },
  tanya: { robe: 0x6ee08a, robeDark: 0x35824c, skin: 0xe8c0a0, hair: 0x241a33 },
  chaps: { robe: 0xffa04d, robeDark: 0x99561f, skin: 0xcaa080, hair: 0x0f0f0f },
};

const W = 48;
const H = 52;

function paintNpc(scene: Phaser.Scene, key: string, spec: (typeof NPC_SPECS)[string] | undefined, emotion: Emotion): void {
  if (!spec || scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 });

  g.fillStyle(0x0c0c14, 1);
  g.fillRoundedRect(4, 6, W - 8, H - 8, 10);

  g.fillStyle(spec.robeDark, 1);
  g.fillRoundedRect(6, 8, W - 12, H - 12, 9);
  g.fillStyle(spec.robe, 1);
  g.fillRoundedRect(8, 10, W - 16, H - 16, 8);

  g.fillStyle(spec.robeDark, 1);
  g.fillRoundedRect(10, 34, W - 20, H - 40, 4);

  const faceX = 13;
  const faceY = 14;
  const faceW = W - 26;
  g.fillStyle(spec.skin, 1);
  g.fillRoundedRect(faceX, faceY, faceW, 20, 5);

  g.fillStyle(spec.hair, 1);
  g.fillRoundedRect(faceX, faceY, faceW, 5, 2);

  const eyeLy = 20;
  const eyeWhiteR = emotion === 'scared' ? 5 : emotion === 'happy' ? 4 : 4;
  const eyePupilR = emotion === 'scared' ? 2 : 2.6;
  g.fillStyle(0xffffff, 1);
  if (emotion === 'happy') {
    g.lineStyle(2, 0xffffff, 1);
    g.beginPath();
    g.arc(19, eyeLy + 2, 4, Math.PI, 0, false);
    g.strokePath();
    g.beginPath();
    g.arc(29, eyeLy + 2, 4, Math.PI, 0, false);
    g.strokePath();
  } else if (emotion === 'doomed') {
    g.lineStyle(2, 0xcc2222, 1);
    for (const cx of [19, 29]) {
      g.beginPath();
      g.moveTo(cx - 3, eyeLy - 3);
      g.lineTo(cx + 3, eyeLy + 3);
      g.moveTo(cx + 3, eyeLy - 3);
      g.lineTo(cx - 3, eyeLy + 3);
      g.strokePath();
    }
  } else {
    g.fillEllipse(19, eyeLy, eyeWhiteR * 2, eyeWhiteR * 2);
    g.fillEllipse(29, eyeLy, eyeWhiteR * 2, eyeWhiteR * 2);
    g.fillStyle(0x101014, 1);
    const pupilDx = emotion === 'sad' ? -1 : 0;
    g.fillEllipse(19 + pupilDx, eyeLy, eyePupilR * 2, eyePupilR * 2);
    g.fillEllipse(29 + pupilDx, eyeLy, eyePupilR * 2, eyePupilR * 2);
  }

  const mouthCy = faceY + 14;
  if (emotion === 'scared') {
    g.fillStyle(0x2a1015, 1);
    g.fillEllipse(24, mouthCy + 2, 6, 7);
  } else if (emotion === 'happy') {
    g.fillStyle(0x2a1015, 1);
    g.fillRoundedRect(19, mouthCy, 10, 5, 2);
    g.fillStyle(spec.skin, 1);
    g.fillRect(19, mouthCy - 1, 10, 3);
  } else if (emotion === 'sad') {
    g.fillStyle(0x30131a, 1);
    g.fillRoundedRect(19, mouthCy + 2, 10, 4, 2);
    g.fillStyle(spec.skin, 1);
    g.fillRect(19, mouthCy + 4, 10, 3);
  } else if (emotion === 'doomed') {
    g.fillStyle(0x30131a, 1);
    g.fillRoundedRect(20, mouthCy, 9, 6, 2);
  } else {
    g.fillStyle(0x2a1015, 1);
    g.fillRoundedRect(20, mouthCy + 2, 8, 2, 1);
  }

  if (emotion === 'scared' || emotion === 'sad') {
    g.fillStyle(0x77ccff, 1);
    g.fillEllipse(27, eyeLy + 6, 3, 5);
  }

  g.generateTexture(key, W, H);
  g.destroy();
}

export function generateSprites(scene: Phaser.Scene): void {
  paintTexture(scene, 'px-player-stand', PLAYER_STAND, PLAYER_PALETTE);
  paintTexture(scene, 'px-player-run0', PLAYER_RUN0, PLAYER_PALETTE);
  paintTexture(scene, 'px-player-run1', PLAYER_RUN1, PLAYER_PALETTE);
  paintTexture(scene, 'px-player-crouch', PLAYER_CROUCH, PLAYER_PALETTE);
  paintTexture(scene, 'px-drone-0', DRONE_A, DRONE_PALETTE);
  paintTexture(scene, 'px-drone-1', DRONE_B, DRONE_PALETTE);
  paintTexture(scene, 'px-hazard', HAZARD_STRIPE, HAZARD_PALETTE);

  const emotions: Emotion[] = ['neutral', 'scared', 'happy', 'sad', 'doomed'];
  for (const [key, spec] of Object.entries(NPC_SPECS)) {
    for (const emotion of emotions) {
      paintNpc(scene, `px-npc-${key}-${emotion}`, spec, emotion);
    }
  }
}
