import { Player } from '../entities/player';
import { ScoreEntry } from '../entities/score-entry';
import { Scoreboard } from '../entities/scoreboard';

// === Snapshot Contracts ===
// Unique construct: `Record` + `Partial<Record<...>>` keeps penalty ledgers strongly typed while allowing sparse input.
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

// === Snapshot Serialization and Rehydration ===

/**
 * @description Serializes a domain `Scoreboard` aggregate into a transport/persistence snapshot.
 * @param scoreboard - Domain aggregate holding players, rounds, and score entries.
 * @returns ScoreboardSnapshot with seat-ordered players, round score rows, zero-initialized penalties, totals, and `started` status.
 * - Used by:
 *   - External consumers importing `domain/snapshots/scoreboard-snapshot` (re-exported via `packages/domain/src/snapshots/index.ts`).
 * - Side effects:
 *   - None (pure mapping).
 */
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

/**
 * @description Rehydrates a `Scoreboard` aggregate from a persisted snapshot payload.
 * @param snapshot - Serialized scoreboard state containing player identities and round score rows.
 * @returns Scoreboard domain aggregate created from reconstructed `Player` and `ScoreEntry` entities.
 * - Used by:
 *   - External consumers importing `domain/snapshots/scoreboard-snapshot` for state restore workflows.
 * - Side effects:
 *   - None; creates in-memory domain objects only.
 */
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

// === Summary and Penalty Aggregation ===

/**
 * @description Computes adjusted totals and leaderboard metadata from a snapshot.
 * @param snapshot - Snapshot containing round scores and penalty ledger input.
 * @returns ScoreboardSummary with penalty-normalized totals, leader, penalty totals, and round/player counts.
 * - Used by:
 *   - External consumers importing summary helpers from the domain snapshot module.
 * - Side effects:
 *   - None (derived calculation).
 * - Unique pattern:
 *   - Uses `ScoreboardSummary['leader']` as a typed reducer target; leader is selected by the lowest adjusted total.
 */
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

// === Internal Penalty Ledger Helpers ===

/**
 * @description Internal-only helper that creates a zeroed penalty ledger for each player and penalty kind.
 * @param players - Snapshot player list used as ledger keys.
 * @returns PenaltyLedger with all `PENALTY_KINDS` initialized to `0` per player.
 * - Used by:
 *   - `serializeScoreboardToSnapshot` during initial snapshot construction.
 * - Side effects:
 *   - None.
 */
const buildEmptyPenaltyLedger = (players: ScoreboardPlayerSnapshot[]): PenaltyLedger => {
  return players.reduce<PenaltyLedger>((ledger, player) => {
    ledger[player.id] = PENALTY_KINDS.reduce((acc, kind) => {
      acc[kind] = 0;
      return acc;
    }, {} as Record<PenaltyKind, number>);
    return ledger;
  }, {});
};

/**
 * @description Internal-only helper that normalizes optional/sparse penalty input into a complete ledger.
 * @param players - Snapshot player list used to enforce complete per-player keys.
 * @param ledger - Optional sparse penalty ledger from persisted or caller-provided input.
 * @returns PenaltyLedger containing all players and all `PENALTY_KINDS`, defaulting missing values to `0`.
 * - Used by:
 *   - `computeGameSummary` before penalty total aggregation.
 * - Side effects:
 *   - None.
 */
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
