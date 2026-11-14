export type ChoiceValue = -1 | 0 | 1;

export type EndingId = 'hero' | 'neutral' | 'outcast';

export type PlayedChoiceDto = {
  npc: string;
  label: string;
  value: ChoiceValue;
};

export type DailyResult = {
  endingId: EndingId;
  score: number;
  saved: number;
  timeMs: number;
  choices: PlayedChoiceDto[];
};

export type DailyInitResponse = {
  type: 'daily-init';
  dayKey: string;
  dayNumber: number;
  username: string;
  order: number[];
  alreadyPlayed: boolean;
  previousResult: DailyResult | null;
  streak: number;
};

export type AggregateStats = {
  playersToday: number;
  endings: Record<EndingId, number>;
  npcBreakdown: {
    npc: string;
    rescue: number;
    neutral: number;
    sacrifice: number;
  }[];
};

export type DailySubmitResponse = {
  type: 'daily-submit';
  dayKey: string;
  dayNumber: number;
  rank: number;
  playersToday: number;
  streak: number;
  aggregate: AggregateStats;
};

export type ShareResponse = {
  success: boolean;
  message: string;
};

export type ErrorResponse = {
  status: 'error';
  message: string;
};
