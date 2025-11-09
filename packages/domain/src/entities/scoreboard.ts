import { Player } from './player';
import { ScoreEntry } from './score-entry';
import { PlayerId } from '../value-objects/player-id';
import { Points } from '../value-objects/points';
import { RoundNumber } from '../value-objects/round-number';

type PlayerTotals = Record<PlayerId, Points>;

export interface ScoreboardProps {
  readonly players: Player[];
  readonly scores: ScoreEntry[];
}

export class Scoreboard {
  private readonly playersById: Map<PlayerId, Player>;
  private readonly scores: ScoreEntry[];

  private constructor(private readonly props: ScoreboardProps) {
    this.playersById = new Map(props.players.map((player) => [player.id, player]));
    this.scores = [...props.scores].sort((a, b) => a.round - b.round);

    if (this.playersById.size !== props.players.length) {
      throw new Error('Scoreboard players must have unique ids.');
    }

    this.scores.forEach((score) => {
      this.assertPlayerExists(score.playerId);
    });
  }

  static create(players: Player[], scores: ScoreEntry[] = []): Scoreboard {
    return new Scoreboard({ players: [...players], scores: [...scores] });
  }

  getPlayers(): Player[] {
    return [...this.props.players];
  }

  getScores(): ScoreEntry[] {
    return [...this.scores];
  }

  recordScore(entry: ScoreEntry): Scoreboard {
    this.assertPlayerExists(entry.playerId);

    const updatedScores = [...this.scores, entry].sort((a, b) => a.round - b.round);
    return new Scoreboard({ players: this.getPlayers(), scores: updatedScores });
  }

  recordRound(round: RoundNumber, entries: ScoreEntry[]): Scoreboard {
    const nextScores = entries.reduce<Scoreboard>((board, entry) => {
      if (entry.round !== round) {
        throw new Error('ScoreEntry round mismatch.');
      }

      return board.recordScore(entry);
    }, this);

    return Scoreboard.create(nextScores.getPlayers(), nextScores.getScores());
  }

  getTotals(): PlayerTotals {
    return this.scores.reduce<PlayerTotals>((totals, entry) => {
      totals[entry.playerId] = (totals[entry.playerId] ?? 0) + entry.points;
      return totals;
    }, {} as PlayerTotals);
  }

  getPlayerTotal(playerId: PlayerId): Points {
    this.assertPlayerExists(playerId);
    return this.getTotals()[playerId] ?? 0;
  }

  getRounds(): RoundNumber[] {
    return Array.from(new Set(this.scores.map((score) => score.round))).sort((a, b) => a - b);
  }

  toJSON(): ScoreboardProps {
    return {
      players: this.getPlayers(),
      scores: this.getScores(),
    };
  }

  private assertPlayerExists(playerId: PlayerId): void {
    if (!this.playersById.has(playerId)) {
      throw new Error(`Player with id ${playerId} does not exist on this scoreboard.`);
    }
  }
}
