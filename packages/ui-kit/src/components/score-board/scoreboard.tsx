import {
  ChangeEvent,
  ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react';
import '../../themes/palette.css';
import './scoreboard.css';
const PLAYER_ACCENTS = [
  'var(--color-honolulu-blue, #007cbeff)',
  'var(--color-gold, #ffd639ff)',
  'var(--color-selective-yellow, #fbaf00ff)',
  'var(--color-pigment-green, #00af54ff)'
];
const PENALTY_TYPES = [
  {
    id: 'misplay',
    label: 'Misplay',
    description: 'Wrong tile or illegal move',
    icon: '⚠️',
    weight: 10,
    color: 'var(--selective-yellow, #fbaf00ff)'
  },
  {
    id: 'okeyToOpponent',
    label: 'Okey to Opponent',
    description: 'Discarded a tile that helped the opponent',
    icon: '🂱',
    weight: 20,
    color: 'var(--salmon-pink, #ffa3afff)'
  },
  {
    id: 'slowPlay',
    label: 'Slow Play',
    description: 'Exceeded the allowed time',
    icon: '⏱️',
    weight: 5,
    color: 'var(--honolulu-blue, #007cbeff)'
  }
];
type PenaltyId = (typeof PENALTY_TYPES)[number]['id'];
interface Player {
  id: string;
  name: string;
}
interface Round {
  id: string;
  scores: number[];
}
type PenaltyState = Record<string, Record<PenaltyId, number>>;
export interface ScoreBoardSnapshot {
  players: Player[];
  rounds: Round[];
  penalties: PenaltyState;
  totals: number[];
  started: boolean;
}
export interface ScoreBoardProps {
  title?: string;
  minPlayers?: number;
  maxPlayers?: number;
  initialPlayers?: string[];
  initialRounds?: Array<{ scores: number[] }>;
  initialPenalties?: Array<Partial<Record<PenaltyId, number>>>;
  onStateChange?: (snapshot: ScoreBoardSnapshot) => void;
}
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
const makeId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Math.random().toString(36).slice(2, 9)}`;
const buildPlayerSeed = (
  targetCount: number,
  providedNames?: string[]
): Player[] =>
  Array.from({ length: targetCount }, (_, index) => ({
    id: `player-${index + 1}-${makeId()}`,
    name: providedNames?.[index] ?? `Player ${index + 1}`
  }));
const adjustScores = (scores: number[], playerCount: number): number[] => {
  const next = scores
    .slice(0, playerCount)
    .map((value) => clamp(value, 0, 999));
  while (next.length < playerCount) {
    next.push(0);
  }
  return next;
};
const createEmptyRound = (playerCount: number): Round => ({
  id: `round-${makeId()}`,
  scores: Array.from({ length: playerCount }, () => 0)
});
const buildInitialRounds = (
  playerCount: number,
  initialRounds?: Array<{ scores: number[] }>
): Round[] => {
  if (initialRounds && initialRounds.length > 0) {
    return initialRounds.map((round) => ({
      id: `round-${makeId()}`,
      scores: adjustScores(round.scores ?? [], playerCount)
    }));
  }
  return [createEmptyRound(playerCount)];
};
const buildInitialPenalties = (
  players: Player[],
  initialPenalties?: Array<Partial<Record<PenaltyId, number>>>
): PenaltyState => {
  return players.reduce<PenaltyState>((acc, player, index) => {
    acc[player.id] = PENALTY_TYPES.reduce<Record<PenaltyId, number>>(
      (memo, penalty) => {
        const count = initialPenalties?.[index]?.[penalty.id] ?? 0;
        memo[penalty.id] = Math.max(0, count);
        return memo;
      },
      {} as Record<PenaltyId, number>
    );
    return acc;
  }, {});
};
const syncPenaltyState = (
  players: Player[],
  current: PenaltyState
): PenaltyState =>
  players.reduce<PenaltyState>((acc, player) => {
    const existing = current[player.id] ?? {};
    acc[player.id] = PENALTY_TYPES.reduce<Record<PenaltyId, number>>(
      (memo, penalty) => {
        memo[penalty.id] = existing[penalty.id] ?? 0;
        return memo;
      },
      {} as Record<PenaltyId, number>
    );
    return acc;
  }, {});
const getAccent = (index: number) =>
  PLAYER_ACCENTS[index] ??
  PLAYER_ACCENTS[PLAYER_ACCENTS.length - 1] ??
  '#007cbeff';
export function ScoreBoard({
  title = 'Okey Score Table',
  minPlayers = 2,
  maxPlayers = 4,
  initialPlayers,
  initialRounds,
  initialPenalties,
  onStateChange
}: ScoreBoardProps): ReactElement {
  const initialCount = useMemo(() => {
    const requested = initialPlayers?.length ?? minPlayers;
    return clamp(requested, minPlayers, maxPlayers);
  }, [initialPlayers, minPlayers, maxPlayers]);
  const playerSeed = useMemo(
    () => buildPlayerSeed(initialCount, initialPlayers),
    [initialCount, initialPlayers]
  );
  const [players, setPlayers] = useState<Player[]>(playerSeed);
  const [rounds, setRounds] = useState<Round[]>(() =>
    buildInitialRounds(playerSeed.length, initialRounds)
  );
  const [penalties, setPenalties] = useState<PenaltyState>(() =>
    buildInitialPenalties(playerSeed, initialPenalties)
  );
  const [gameStarted, setGameStarted] = useState<boolean>(() =>
    Boolean(initialRounds && initialRounds.length)
  );
  const totals = useMemo(() => {
    return players.map((player, playerIndex) => {
      const scoreSum = rounds.reduce(
        (acc, round) => acc + (round.scores[playerIndex] ?? 0),
        0
      );
      const penaltySum = PENALTY_TYPES.reduce((acc, penalty) => {
        const count = penalties[player.id]?.[penalty.id] ?? 0;
        return acc + count * penalty.weight;
      }, 0);
      return scoreSum + penaltySum;
    });
  }, [players, rounds, penalties]);
  const finiteTotals = totals.filter((value) => Number.isFinite(value));
  const lowestTotal = finiteTotals.length > 0 ? Math.min(...finiteTotals) : 0;
  useEffect(() => {
    if (!onStateChange) {
      return;
    }
    onStateChange({
      players,
      rounds,
      penalties,
      totals,
      started: gameStarted
    });
  }, [players, rounds, penalties, totals, gameStarted, onStateChange]);
  const markGameStarted = useCallback(() => {
    setGameStarted((prev) => (prev ? prev : true));
  }, []);
  const handlePlayerCountChange = useCallback(
    (count: number) => {
      if (gameStarted) {
        return;
      }
      const targetCount = clamp(count, minPlayers, maxPlayers);
      if (targetCount === players.length) {
        return;
      }
      const nextPlayers: Player[] = Array.from(
        { length: targetCount },
        (_, index) =>
          players[index] ?? {
            id: `player-${makeId()}`,
            name: `Player ${index + 1}`
          }
      );
      setPlayers(nextPlayers);
      setRounds((prev) =>
        prev.map((round) => ({
          ...round,
          scores: adjustScores(round.scores, targetCount)
        }))
      );
      setPenalties((prev) => syncPenaltyState(nextPlayers, prev));
    },
    [gameStarted, maxPlayers, minPlayers, players]
  );
  const handleAddPlayer = useCallback(() => {
    if (players.length >= maxPlayers || gameStarted) {
      return;
    }
    handlePlayerCountChange(players.length + 1);
  }, [players.length, maxPlayers, gameStarted, handlePlayerCountChange]);
  const handleRenamePlayer = useCallback((playerId: string, name: string) => {
    setPlayers((prev) =>
      prev.map((player) =>
        player.id === playerId ? { ...player, name } : player
      )
    );
  }, []);
  const handleScoreChange = useCallback(
    (
      roundIndex: number,
      playerIndex: number,
      event: ChangeEvent<HTMLInputElement>
    ) => {
      const value = event.target.value === '' ? 0 : Number(event.target.value);
      const nextValue = Number.isNaN(value) ? 0 : clamp(value, 0, 999);
      setRounds((prev) =>
        prev.map((round, index) =>
          index === roundIndex
            ? {
                ...round,
                scores: round.scores.map((score, idx) =>
                  idx === playerIndex ? nextValue : score
                )
              }
            : round
        )
      );
      if (nextValue > 0) {
        markGameStarted();
      }
    },
    [markGameStarted]
  );
  const handleAddRound = useCallback(() => {
    setRounds((prev) => [...prev, createEmptyRound(players.length)]);
  }, [players.length]);
  const handleDeleteRound = useCallback((roundId: string) => {
    setRounds((prev) =>
      prev.length > 1 ? prev.filter((round) => round.id !== roundId) : prev
    );
  }, []);
  const handleIncrementPenalty = useCallback(
    (playerId: string, penaltyId: PenaltyId) => {
      setPenalties((prev) => ({
        ...prev,
        [playerId]: {
          ...prev[playerId],
          [penaltyId]: (prev[playerId]?.[penaltyId] ?? 0) + 1
        }
      }));
      markGameStarted();
    },
    [markGameStarted]
  );
  const handleStartGame = useCallback(() => {
    setGameStarted(true);
  }, []);
  const handleResetGame = useCallback(() => {
    setRounds([createEmptyRound(players.length)]);
    setPenalties(syncPenaltyState(players, {}));
    setGameStarted(false);
  }, [players]);
  const disablePlayerControls = gameStarted;
  return (
    <div className="scoreboard-wrapper">
      <div className="scoreboard-card" role="table" aria-label={title}>
        <header className="scoreboard-header">
          <div className="scoreboard-header-info">
            <h2 className="scoreboard-title">{title}</h2>
            <p className="scoreboard-subtitle">
              Track up to four players — lowest score wins.
            </p>
          </div>
          <div className="scoreboard-actions">
            <button
              type="button"
              onClick={handleStartGame}
              disabled={gameStarted}
              className="scoreboard-start-btn"
            >
              {gameStarted ? 'Game Locked' : 'Start Game'}
            </button>
            <button
              type="button"
              onClick={handleResetGame}
              className="scoreboard-reset-btn"
            >
              Reset
            </button>
          </div>
        </header>
        <section
          aria-label="Player controls"
          className="scoreboard-player-controls"
        >
          <div
            role="group"
            aria-label="Select player count"
            className="scoreboard-player-count-toggle"
          >
            {[2, 3, 4]
              .filter((count) => count >= minPlayers && count <= maxPlayers)
              .map((count) => {
                const isActive = players.length === count;
                return (
                  <button
                    key={count}
                    type="button"
                    disabled={disablePlayerControls}
                    onClick={() => handlePlayerCountChange(count)}
                    className={`scoreboard-player-count-option${
                      isActive ? ' active' : ''
                    }`}
                  >
                    {count}
                  </button>
                );
              })}
          </div>
          <button
            type="button"
            aria-label="Add player"
            onClick={handleAddPlayer}
            disabled={disablePlayerControls || players.length >= maxPlayers}
            className="scoreboard-player-add-btn"
          >
            +
          </button>
          {gameStarted && (
            <span className="scoreboard-player-lock-message">
              Player setup locked for this game.
            </span>
          )}
        </section>
        <section role="rowgroup" className="scoreboard-rowgroup">
          <div
            role="row"
            className="scoreboard-players-row"
            style={{
              gridTemplateColumns: `repeat(${players.length}, minmax(0, 1fr))`
            }}
          >
            {players.map((player, index) => (
              <div
                key={player.id}
                className="scoreboard-player-card"
                style={{ border: `1px solid ${getAccent(index)}` }}
              >
                <input
                  aria-label={`Rename ${player.name}`}
                  value={player.name}
                  onChange={(event) =>
                    handleRenamePlayer(player.id, event.target.value)
                  }
                  className="scoreboard-player-input"
                />
              </div>
            ))}
          </div>
          {rounds.map((round, roundIndex) => (
            <div
              key={round.id}
              role="row"
              className="scoreboard-round-row"
              style={{
                gridTemplateColumns: `repeat(${players.length}, minmax(0, 1fr)) auto`
              }}
            >
              {players.map((_, playerIndex) => (
                <input
                  key={`${round.id}-${playerIndex}`}
                  type="number"
                  min={0}
                  max={999}
                  value={round.scores[playerIndex] ?? 0}
                  onChange={(event) =>
                    handleScoreChange(roundIndex, playerIndex, event)
                  }
                  aria-label={`Round ${roundIndex + 1} score for ${
                    players[playerIndex].name
                  }`}
                  className="scoreboard-score-input"
                />
              ))}
              <button
                type="button"
                aria-label={`Delete round ${roundIndex + 1}`}
                onClick={() => handleDeleteRound(round.id)}
                disabled={rounds.length === 1}
                className="scoreboard-round-delete"
              >
                🗑️
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={handleAddRound}
            className="scoreboard-add-round-btn"
          >
            + Add round
          </button>
        </section>
        <section aria-labelledby="penalties" className="scoreboard-penalties">
          <div id="penalties" className="scoreboard-penalties-header">
            <h3 className="scoreboard-penalties-title">Penalties</h3>
            <span className="scoreboard-penalties-description">
              Tap a chip to add a penalty to a player
            </span>
          </div>
          <div className="scoreboard-penalty-list">
            {PENALTY_TYPES.map((penalty) => (
              <div key={penalty.id} className="scoreboard-penalty-row">
                <div className="scoreboard-penalty-info">
                  <strong style={{ color: penalty.color }}>
                    {penalty.icon}
                  </strong>{' '}
                  <span className="scoreboard-penalty-label">
                    {penalty.label}
                  </span>
                  <p className="scoreboard-penalty-copy">
                    {penalty.description}
                  </p>
                </div>
                <div className="scoreboard-penalty-buttons">
                  {players.map((player, index) => (
                    <button
                      key={`${player.id}-${penalty.id}`}
                      type="button"
                      onClick={() =>
                        handleIncrementPenalty(player.id, penalty.id)
                      }
                      className="scoreboard-penalty-button"
                    >
                      <span className="scoreboard-penalty-player">
                        <span
                          className="scoreboard-penalty-player-dot"
                          style={{ background: getAccent(index) }}
                        />
                        {player.name}
                      </span>
                      <span>{penalties[player.id]?.[penalty.id] ?? 0}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="scoreboard-totals" role="row" aria-label="Totals">
          <div
            className="scoreboard-totals-grid"
            style={{
              gridTemplateColumns: `repeat(${players.length}, minmax(0, 1fr))`
            }}
          >
            {players.map((player, index) => {
              const total = totals[index] ?? 0;
              const isLeader = total === lowestTotal && totals.length > 0;
              return (
                <div
                  key={`${player.id}-total`}
                  className="scoreboard-total-card"
                  style={{ border: `1px solid ${getAccent(index)}` }}
                >
                  <div className="scoreboard-total-player">{player.name}</div>
                  <div className="scoreboard-total-score">{total}</div>
                  {isLeader && (
                    <span
                      className="scoreboard-winner-badge"
                      aria-label="leader"
                    >
                      ✓
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
        <footer className="scoreboard-footer">
          <span>Lowest score wins</span>
        </footer>
      </div>
    </div>
  );
}
