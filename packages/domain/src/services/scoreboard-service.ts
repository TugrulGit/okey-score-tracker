import { Player } from '../entities/player';
import { ScoreEntry } from '../entities/score-entry';
import { Scoreboard } from '../entities/scoreboard';
import { PlayerId, createPlayerId } from '../value-objects/player-id';
import { Points } from '../value-objects/points';
import { RoundNumber, createRoundNumber } from '../value-objects/round-number';

export interface PlayerInput {
  id: string;
  name: string;
}

export interface ScoreInput {
  round: number;
  playerId: string;
  points: number;
}

export interface RoundScoreInput {
  playerId: string;
  points: number;
}

export interface LeaderboardRow {
  player: Player;
  total: Points;
}

export const initializeScoreboard = (
  players: PlayerInput[],
  scores: ScoreInput[] = []
): Scoreboard => {
  const playerEntities = players.map(Player.create);
  const scoreEntries = scores.map(ScoreEntry.create);

  return Scoreboard.create(playerEntities, scoreEntries);
};

export const applyRoundScores = (
  scoreboard: Scoreboard,
  round: number,
  scores: RoundScoreInput[]
): Scoreboard => {
  const roundNumber = createRoundNumber(round);

  return scores.reduce((board, score) => {
    const entry = ScoreEntry.create({
      round: roundNumber,
      playerId: score.playerId,
      points: score.points,
    });

    return board.recordScore(entry);
  }, scoreboard);
};

export const getLeaderboard = (scoreboard: Scoreboard): LeaderboardRow[] => {
  const totals = scoreboard.getTotals();

  return scoreboard
    .getPlayers()
    .map((player) => ({
      player,
      total: totals[player.id] ?? 0,
    }))
    .sort((a, b) => b.total - a.total);
};

export const getPlayerTotal = (scoreboard: Scoreboard, playerId: string): Points => {
  const id: PlayerId = createPlayerId(playerId);
  return scoreboard.getPlayerTotal(id);
};

export const getRounds = (scoreboard: Scoreboard): RoundNumber[] => {
  return scoreboard.getRounds();
};
