export function shouldShowTutorial(): boolean {
  try {
    return globalThis.localStorage?.getItem('ep_tutorial_done') !== '1';
  } catch {
    return false;
  }
}

export function markTutorialDone(): void {
  try {
    globalThis.localStorage?.setItem('ep_tutorial_done', '1');
  } catch {
    return;
  }
}

export type TutorialHint = {
  x: number;
  text: string;
  icon: string;
  color: string;
};

export const SECTOR_ONE_HINTS: TutorialHint[] = [
  {
    x: 340,
    text: 'HOLD RUN to advance\nRelease = you stand still\nStill = invisible to cones',
    icon: '\u27a1\ufe0f',
    color: '#ffaa33',
  },
  {
    x: 1050,
    text: 'GAP AHEAD\nTap JUMP to cross\nRed glow = danger, time penalty if swallowed',
    icon: '\u2b06\ufe0f',
    color: '#00ffcc',
  },
  {
    x: 1500,
    text: 'DRONE SWEEP\nOnly moving bodies get caught\nFreeze to clear its cone',
    icon: '\u26a1',
    color: '#ff5555',
  },
  {
    x: 1970,
    text: 'THEY NEED YOU\nReach them, then choose\nRescue costs seconds. Sacrifice earns them',
    icon: '\u2764\ufe0f',
    color: '#ff7fa5',
  },
];
