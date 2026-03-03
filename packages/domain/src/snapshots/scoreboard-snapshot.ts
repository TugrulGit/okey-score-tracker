import { Player } from '../entities/player';
import { ScoreEntry } from '../entities/score-entry';
import { Scoreboard } from '../entities/scoreboard';

export type PenaltyKind = 'MISPLAY' | 'OKEY_TO_OPPONENT' | 'USEFUL_TILE' | 'FINISHER';

export const PENALTY_KINDS: PenaltyKind[] = ['MISPLAY', 'OKEY_TO_OPPONENT', 'USEFUL_TILE', 'FINISHER'];

export type PenaltyLedger = Record<string, Partial<Record<PenaltyKind, number>>>;

export interface ScoreboardPlayerSnapshot {
  id: string;
  name: string;
  seatIndex?: number;
  userId?: string | null;
  avatarColor?: string | null;
}

export interface ScoreboardRoundScoreSnapshot {
  playerId: string;
  points: number;
}

export interface ScoreboardRoundSnapshot {
  id?: string;
  round: number;
  scores: ScoreboardRoundScoreSnapshot[];
}

export interface ScoreboardSnapshot {
  players: ScoreboardPlayerSnapshot[];
  rounds: ScoreboardRoundSnapshot[];
  penalties: PenaltyLedger;
  totals: Record<string, number>;
  started: boolean;
}

export interface ScoreboardSummary {
  totals: Record<string, number>;
  leader: {
    playerId: string;
    name: string;
    total: number;
  } | null;
  penalties: PenaltyLedger;
  penaltyTotals: Record<string, number>;
  roundCount: number;
  playerCount: number;
}

export const serializeScoreboardToSnapshot = (scoreboard: Scoreboard): ScoreboardSnapshot => {
  const players = scoreboard.getPlayers().map((player, index) => ({
    id: player.id,
    name: player.name,
    seatIndex: index
  }));
  const rounds = scoreboard.getRounds().map((roundNumber) => ({
    round: roundNumber,
    scores: scoreboard
      .getScores()
      .filter((score) => score.round === roundNumber)
      .map((score) => ({
        playerId: score.playerId,
        points: score.points
      }))
  }));
  const totals = scoreboard.getTotals();
  return {
    players,
    rounds,
    penalties: buildEmptyPenaltyLedger(players),
    totals,
    started: rounds.length > 0
  };
};

export const hydrateScoreboardFromSnapshot = (snapshot: ScoreboardSnapshot): Scoreboard => {
  const players = snapshot.players.map((player) =>
    Player.create({
      id: player.id,
      name: player.name
    })
  );
  const scores = snapshot.rounds
    .flatMap((round) =>
      round.scores.map((score) =>
        ScoreEntry.create({
          round: round.round,
          playerId: score.playerId,
          points: score.points
        })
      )
    )
    .sort((a, b) => a.round - b.round);

  return Scoreboard.create(players, scores);
};

export const computeGameSummary = (snapshot: ScoreboardSnapshot): ScoreboardSummary => {
  const totals = snapshot.rounds.reduce<Record<string, number>>((acc, round) => {
    round.scores.forEach((score) => {
      acc[score.playerId] = (acc[score.playerId] ?? 0) + score.points;
    });
    return acc;
  }, {});

  const penalties = normalizePenaltyLedger(snapshot.players, snapshot.penalties);
  const penaltyTotals = Object.entries(penalties).reduce<Record<string, number>>((acc, [playerId, ledger]) => {
    acc[playerId] = PENALTY_KINDS.reduce((sum, kind) => sum + (ledger[kind] ?? 0), 0);
    return acc;
  }, {});

  const adjustedTotals = snapshot.players.reduce<Record<string, number>>((acc, player) => {
    const base = totals[player.id] ?? 0;
    const penalty = penaltyTotals[player.id] ?? 0;
    acc[player.id] = base - penalty;
    return acc;
  }, {});

  const leader = snapshot.players.reduce<ScoreboardSummary['leader']>((current, player) => {
    const total = adjustedTotals[player.id] ?? 0;
    if (!current || total < current.total) {
      return {
        playerId: player.id,
        name: player.name,
        total
      };
    }
    return current;
  }, null);

  return {
    totals: adjustedTotals,
    leader,
    penalties,
    penaltyTotals,
    roundCount: snapshot.rounds.length,
    playerCount: snapshot.players.length
  };
};

const buildEmptyPenaltyLedger = (players: ScoreboardPlayerSnapshot[]): PenaltyLedger => {
  return players.reduce<PenaltyLedger>((ledger, player) => {
    ledger[player.id] = PENALTY_KINDS.reduce((acc, kind) => {
      acc[kind] = 0;
      return acc;
    }, {} as Record<PenaltyKind, number>);
    return ledger;
  }, {});
};

const normalizePenaltyLedger = (
  players: ScoreboardPlayerSnapshot[],
  ledger: PenaltyLedger | undefined
): PenaltyLedger => {
  const safeLedger = ledger ?? {};
  return players.reduce<PenaltyLedger>((acc, player) => {
    const playerLedger = safeLedger[player.id] ?? {};
    acc[player.id] = PENALTY_KINDS.reduce((current, kind) => {
      current[kind] = playerLedger[kind] ?? 0;
      return current;
    }, {} as Record<PenaltyKind, number>);
    return acc;
  }, {});
};
