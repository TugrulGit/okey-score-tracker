import { PlayerId, createPlayerId } from '../value-objects/player-id';
import { Points, createPoints } from '../value-objects/points';
import { RoundNumber, createRoundNumber } from '../value-objects/round-number';

export interface ScoreEntryProps {
  readonly round: RoundNumber;
  readonly playerId: PlayerId;
  readonly points: Points;
}

export class ScoreEntry {
  private constructor(private readonly props: ScoreEntryProps) {}

  static create(raw: { round: number; playerId: string; points: number }): ScoreEntry {
    return new ScoreEntry({
      round: createRoundNumber(raw.round),
      playerId: createPlayerId(raw.playerId),
      points: createPoints(raw.points),
    });
  }

  static from(props: ScoreEntryProps): ScoreEntry {
    return new ScoreEntry(props);
  }

  get round(): RoundNumber {
    return this.props.round;
  }

  get playerId(): PlayerId {
    return this.props.playerId;
  }

  get points(): Points {
    return this.props.points;
  }

  toJSON(): ScoreEntryProps {
    return { ...this.props };
  }
}
