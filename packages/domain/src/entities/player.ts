import { PlayerId, createPlayerId } from '../value-objects/player-id';
import { PlayerName, createPlayerName } from '../value-objects/player-name';

export interface PlayerProps {
  readonly id: PlayerId;
  readonly name: PlayerName;
}

export class Player {
  private constructor(private readonly props: PlayerProps) {}

  static create(raw: { id: string; name: string }): Player {
    return new Player({
      id: createPlayerId(raw.id),
      name: createPlayerName(raw.name),
    });
  }

  static from(props: PlayerProps): Player {
    return new Player(props);
  }

  get id(): PlayerId {
    return this.props.id;
  }

  get name(): PlayerName {
    return this.props.name;
  }

  rename(name: string): Player {
    return new Player({
      ...this.props,
      name: createPlayerName(name),
    });
  }

  toJSON(): PlayerProps {
    return { ...this.props };
  }
}
