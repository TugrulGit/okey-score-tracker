// === Shared game API contracts ===

export type GameStatus = 'ACTIVE' | 'COMPLETED';
export type GamePenaltyType =
  | 'MISPLAY'
  | 'OKEY_TO_OPPONENT'
  | 'USEFUL_TILE'
  | 'FINISHER';

export interface GamePlayer {
  id: string;
  displayName: string;
  userId: string | null;
  seatIndex: number;
  avatarColor?: string | null;
}

export interface GameRoundScore {
  playerId: string;
  points: number;
}

export interface GameRoundPenalty {
  id: string;
  playerId: string;
  type: GamePenaltyType;
  value: number;
}

export interface GameRound {
  id: string;
  index: number;
  scores: GameRoundScore[];
  penalties: GameRoundPenalty[];
}

export interface GameLeader {
  playerId: string;
  displayName: string;
  total: number;
}

export interface GameDetail {
  id: string;
  ownerId: string;
  title: string;
  status: GameStatus;
  notes: string | null;
  startedAt: string;
  completedAt: string | null;
  players: GamePlayer[];
  rounds: GameRound[];
  penalties: Record<string, Record<GamePenaltyType, number>>;
  totals: Record<string, number>;
  leader?: GameLeader;
  isOwner: boolean;
}

export type ActiveGameResponse = GameDetail | null;

export interface CreateGameInput {
  title?: string;
  notes?: string;
  players: Array<{
    displayName: string;
    userId?: string;
    avatarColor?: string;
  }>;
}

export interface AddRoundInput {
  scores: Array<{
    playerId: string;
    points: number;
  }>;
  penalties?: Array<{
    playerId: string;
    type: GamePenaltyType;
    value: number;
  }>;
}

export interface UpdatePlayersInput {
  players: Array<{
    id: string;
    displayName?: string;
    seatIndex?: number;
  }>;
}
