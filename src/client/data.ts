export type ChoiceValue = 1 | 0 | -1;

export type Choice = {
  label: string;
  value: ChoiceValue;
  color: string;
  feedback: string;
};

export type Scenario = {
  key: string;
  npc: string;
  sector: string;
  text: string;
  variants: string[];
  choices: [Choice, Choice, Choice];
  tint: number;
};

export type EndingId = 'hero' | 'neutral' | 'outcast';

export type EndingDef = {
  id: EndingId;
  title: string;
  label: string;
  message: string;
  tint: number;
};

export type PlayedChoice = {
  npc: string;
  label: string;
  value: ChoiceValue;
};

export type RunModifier = {
  speedMult: number;
  alertMult: number;
  label: string;
};

const NEUTRAL_MODIFIER: RunModifier = { speedMult: 1, alertMult: 1, label: '' };

export const gameState = {
  score: 0,
  choices: [] as PlayedChoice[],
  timeMs: 0,
  penaltyMs: 0,
  nextRunModifier: { ...NEUTRAL_MODIFIER } as RunModifier,
};

export function resetGameState(): void {
  gameState.score = 0;
  gameState.choices = [];
  gameState.timeMs = 0;
  gameState.penaltyMs = 0;
  gameState.nextRunModifier = { ...NEUTRAL_MODIFIER };
}

export function modifierForChoice(value: ChoiceValue, npc: string): RunModifier {
  if (value === 1) {
    return {
      speedMult: 0.9,
      alertMult: 1.4,
      label: `ESCORTING ${npc.toUpperCase()} — slower & louder`,
    };
  }
  if (value === -1) {
    return {
      speedMult: 1.08,
      alertMult: 0.8,
      label: 'DRONES DISTRACTED — faster & quieter',
    };
  }
  return { ...NEUTRAL_MODIFIER };
}

export function totalRunMs(): number {
  return gameState.timeMs + gameState.penaltyMs;
}

export function formatMs(ms: number): string {
  const totalTenths = Math.floor(ms / 100);
  const minutes = Math.floor(totalTenths / 600);
  const seconds = Math.floor((totalTenths % 600) / 10);
  const tenths = totalTenths % 10;
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${tenths}`;
}

export const SCENARIOS: Scenario[] = [
  {
    key: 'prisha',
    npc: 'npcPrisha',
    sector: 'SECTOR 7 - EMERGENCY LOCKDOWN ACTIVE',
    text: 'Prisha cowers behind overturned desks, tears streaming down her face as security drones sweep the hallway with red scanning beams.\n\n"Please... I can\'t run anymore. My ankle is twisted and they\'ll find me if I move!"',
    variants: [
      'Prisha is slumped in the gymnasium bleachers, clutching a twisted ankle while the lockdown siren loops over loudspeakers. A patrol cone rakes the stands in slow, even passes.\n\n"I thought this was another drill... I can\'t walk, please, don\'t leave me here!"',
      'Prisha barricaded herself behind the library reference desk, hugging a phone with a dark screen. Fluorescent light buzzes overhead; a drone hums between her and the exit corridor.\n\n"It keeps coming back. Every thirty seconds. Nobody answered my messages. Please."',
      'You find Prisha frozen against the cafeteria freezer row, frost still on her hoodie. Two drones criss-cross the serving line on staggered sweeps.\n\n"It hurts to stand. It hurts to run. If I stay quiet will they pass me? They won\'t, will they?"',
    ],
    choices: [
      {
        label: 'RESCUE - Pull her to safety through the maintenance vent',
        value: 1,
        color: '#00ff00',
        feedback: 'Prisha grabs your hand with desperate gratitude as you guide her to safety.',
      },
      {
        label: 'ABANDON - Tell her to stay hidden until the sweep passes',
        value: 0,
        color: '#ffff00',
        feedback: 'You leave her behind, uncertain if she\'ll survive the next patrol.',
      },
      {
        label: 'SACRIFICE - Create noise to draw drones to her position',
        value: -1,
        color: '#ff0000',
        feedback: 'Her terrified scream echoes as the drones converge on her location.',
      },
    ],
    tint: 0xff6666,
  },
  {
    key: 'advik',
    npc: 'npcAdvik',
    sector: 'SECTOR 5 - STRUCTURAL COLLAPSE DETECTED',
    text: 'Advik is pinned under collapsed ceiling panels, his leg bent at an unnatural angle. Emergency lights flicker as you hear mechanical footsteps approaching.\n\n"Help me! I can hear them in the next corridor - please don\'t leave me here to die!"',
    variants: [
      'Advik is wedged under a collapsed trophy cabinet in the gym hallway, leg twisted. Emergency lights strobe while a drone patrols the adjacent corridor in tight loops.\n\n"It\'s getting closer every pass. I can feel the vibration in the floor. Please — get me out!"',
      'You find Advik half-buried under fallen ductwork in the science block, dust in the air, his hand pinned palm-up. Mechanical footsteps echo closer.\n\n"I heard the lockdown and ran the wrong way. Lift it. I don\'t care if it hurts."',
      'Advik crawls across the lab floor behind a tipped chemistry bench, lab coat torn on broken glass, a scanning cone sweeping the doorway in repeats.\n\n"Every time it passes it stops a half-second longer. Come on. Please come on."',
    ],
    choices: [
      {
        label: 'RESCUE - Use emergency jack to lift the debris',
        value: 1,
        color: '#00ff00',
        feedback: 'Together you escape as Advik leans on your shoulder, grateful to be alive.',
      },
      {
        label: 'DELAY - Promise to send help when you reach safety',
        value: 0,
        color: '#ffff00',
        feedback: 'You rush away, hoping someone else will find him in time.',
      },
      {
        label: 'EXPLOIT - Deliberately trigger collapse alarms near him',
        value: -1,
        color: '#ff0000',
        feedback: 'The security response teams rush toward the distraction you created.',
      },
    ],
    tint: 0x6666ff,
  },
  {
    key: 'tanya',
    npc: 'npcTanya',
    sector: 'SECTOR 3 - EMERGENCY OVERRIDE IN PROGRESS',
    text: 'Tanya frantically works at a damaged control terminal, sparks flying as she bypasses security protocols. Her fingers fly across the interface.\n\n"Thirty seconds! I can override the lockdown for everyone, but I need you to cover the entrance!"',
    variants: [
      'Tanya crouches at a smoke-damaged security terminal, sparks skipping off the keyboard as she threads an override. A drone silhouette slides past the door glass.\n\n"One window left in the cycle. I need a body between me and that door for under a minute."',
      'Tanya wrestles a dead server-room rack, laptop fan screaming, one status LED still green. The lockdown siren pulses through the wall.\n\n"The firmware wants a second pair of hands at the panel. Yours. Now."',
      'Tanya is hunched over a hacked PA console in A/V storage, looping a fake all-clear while the system fights her. The door icon blinks OBSTRUCTED.\n\n"If I let go it re-locks. Watch my back until the override sticks."',
    ],
    choices: [
      {
        label: 'PROTECT - Guard the doorway while she completes the hack',
        value: 1,
        color: '#00ff00',
        feedback: 'The emergency doors unlock with a satisfying beep - escape routes are now open.',
      },
      {
        label: 'OBSERVE - Wait nearby but don\'t actively help',
        value: 0,
        color: '#ffff00',
        feedback: 'She completes the hack alone while you remain safely distant.',
      },
      {
        label: 'BETRAY - Alert security to her location for a distraction',
        value: -1,
        color: '#ff0000',
        feedback: 'Armed drones storm the room as you slip away in the chaos.',
      },
    ],
    tint: 0x66ff66,
  },
  {
    key: 'chaps',
    npc: 'npcChaps',
    sector: 'SECTOR 1 - MEDICAL EMERGENCY DETECTED',
    text: 'Chaps sits in the corner clutching a bloody arm, eyes wide with shock and terror. The aftermath of violence is evident around him.\n\n"They just... left me here when the shooting started. Everyone ran past like I was already dead. Please... don\'t abandon me too..."',
    variants: [
      'Chaps sits slumped in the locker-room showers, gym-bag tourniquet slipping loose, sprinkler water diluting red across the tile. A patrol cone skates the frosted glass.\n\n"They ran past me when it started. All of them. I could hear my own name. Help me up."',
      'Chaps huddles under the auditorium stage, arm bloodied from fallen scaffolding, stage light sweep visible through the floor gratings above.\n\n"Everyone assumed I got out early. Nobody checked. I kept waiting for someone to come back for me."',
      'Chaps is folded behind a janitor cart in the basement corridor, broken glass and mop water around his knees, eyes fixed on the next sweep of light.\n\n"If you go left, the drones go with you. If I move alone, they find me. Which way is safer?"',
    ],
    choices: [
      {
        label: 'EVACUATE - Help him reach the emergency medical station',
        value: 1,
        color: '#00ff00',
        feedback: 'You guide him to safety, his wound bandaged and spirits lifted.',
      },
      {
        label: 'COMFORT - Give him hope but continue your own escape',
        value: 0,
        color: '#ffff00',
        feedback: 'You offer words of encouragement before leaving him to fend for himself.',
      },
      {
        label: 'BAIT - Use his desperate calls to lure enemies away',
        value: -1,
        color: '#ff0000',
        feedback: 'His cries for help mask your escape as hostiles investigate the sound.',
      },
    ],
    tint: 0xff8844,
  },
];

export const ENDINGS: Record<EndingId, EndingDef> = {
  hero: {
    id: 'hero',
    title: "THE HERO'S PATH",
    label: 'HEROIC',
    message:
      "You chose compassion over self-preservation at every turn. Four lives hang in the balance, and four lives were saved through your courage and sacrifice. When the emergency protocols finally lifted, survivor testimonies spoke of a guardian angel who chose to be their light in the darkness. The academy may bear scars, but hope was reborn in the hearts you protected. Your legacy will inspire others to choose heroism when darkness falls.",
    tint: 0x004400,
  },
  neutral: {
    id: 'neutral',
    title: "THE SURVIVOR'S BURDEN",
    label: 'NEUTRAL',
    message:
      "You walked the razor's edge between heroism and survival, saving some while leaving others to their fate. The weight of those choices will follow you long after the emergency lights stop flashing. In the aftermath, you carry both the gratitude of those you saved and the haunting memory of those you didn't. You learned that in crisis, neutrality comes with its own heavy price - the knowledge that you could have done more.",
    tint: 0x444400,
  },
  outcast: {
    id: 'outcast',
    title: "THE OUTCAST'S PRICE",
    label: 'RUTHLESS',
    message:
      'You chose yourself above all others, using your classmates as shields, distractions, and expendable resources. You survived the protocol, but at a cost that will echo through the empty corridors of your conscience. When the dust settled, you stood alone among the consequences of your choices. In saving yourself at any cost, you discovered that some victories hollow out the soul. The academy may be behind you, but your reflection will forever show the price of absolute selfishness.',
    tint: 0x440000,
  },
};

export function resolveEndingId(score: number): EndingId {
  if (score >= 3) return 'hero';
  if (score <= -2) return 'outcast';
  return 'neutral';
}
