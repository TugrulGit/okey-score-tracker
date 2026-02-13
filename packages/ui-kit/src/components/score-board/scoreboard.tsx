// === React & Internal Imports ===
import {
  WheelEvent,
  ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent
} from 'react';
import '../../themes/palette.css';
import './scoreboard.css';
import { GlassButton } from '../buttons/GlassButton';
// Palette accents per player slot; used for player cards and summary chips.
const PLAYER_ACCENTS = [
  'var(--color-honolulu-blue, #007cbeff)',
  'var(--color-gold, #ffd639ff)',
  'var(--color-selective-yellow, #fbaf00ff)',
  'var(--color-pigment-green, #00af54ff)'
];
// Metadata for penalty types shown in cells & summary.
const PENALTY_TYPES = [
  {
    id: 'misplay',
    label: 'Misplay',
    description: 'Wrong tile or illegal move',
    icon: '⚠️',
    color: 'var(--color-selective-yellow, #fbaf00ff)'
  },
  {
    id: 'okeyToOpponent',
    label: 'Okey to Opponent',
    description: 'Discarded a tile that helped the opponent',
    icon: '🂱',
    color: 'var(--color-salmon-pink, #ffa3afff)'
  },
  {
    id: 'usefulTile',
    label: 'Useful Tile',
    description: 'Failed to give up a helpful tile',
    icon: '🧩',
    color: 'var(--color-honolulu-blue, #007cbeff)'
  },
  {
    id: 'finisher',
    label: 'Finisher',
    description: 'Opponent closed their hand',
    icon: '🏁',
    color: 'var(--color-gold, #ffd639ff)'
  }
] as const;
const SCORE_MIN = -800;
const SCORE_MAX = 800;
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

// Per-round penalty entries so each cell shows its penalties inline.
interface PenaltyEntry {
  id: string;
  type: PenaltyId;
  value: number;
}
type RoundPenaltyMap = Record<string, Record<number, PenaltyEntry[]>>;

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
  initialPlayers?: ReadonlyArray<string>;
  initialRounds?: ReadonlyArray<{ scores: ReadonlyArray<number> }>;
  initialPenalties?: ReadonlyArray<Partial<Record<PenaltyId, number>>>;
  onStateChange?: (snapshot: ScoreBoardSnapshot) => void;
}
// === Utility helpers ===
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
const sanitizeScoreInput = (value: number) =>
  clamp(Math.trunc(value), SCORE_MIN, SCORE_MAX);
const makeId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Math.random().toString(36).slice(2, 9)}`;
// Tracks which wheel modal is open (score vs. penalty).
type WheelContext =
  | {
      kind: 'score';
      roundIndex: number;
      playerIndex: number;
      initialValue: number;
    }
  | {
      kind: 'penalty';
      roundIndex: number;
      playerIndex: number;
      penaltyType: PenaltyId;
      initialValue: number;
    };
// --- Seed builders ---
const buildPlayerSeed = (
  targetCount: number,
  providedNames?: ReadonlyArray<string>
): Player[] =>
  Array.from({ length: targetCount }, (_, index) => ({
    id: `player-${index + 1}-${makeId()}`,
    name: providedNames?.[index] ?? `Player ${index + 1}`
  }));
const adjustScores = (
  scores: ReadonlyArray<number>,
  playerCount: number
): number[] => {
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
  initialRounds?: ReadonlyArray<{ scores: ReadonlyArray<number> }>
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
  initialPenalties?: ReadonlyArray<Partial<Record<PenaltyId, number>>>
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
// === Main ScoreBoard component ===
// Renders the full glassy scoreboard, handles players, scores, penalties, and the wheel modal.
export function ScoreBoard({
  title = 'Okey Score Table',
  minPlayers = 2,
  maxPlayers = 4,
  initialPlayers,
  initialRounds,
  initialPenalties,
  onStateChange
}: ScoreBoardProps): ReactElement {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
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
  const [roundPenalties, setRoundPenalties] = useState<RoundPenaltyMap>({});
  const [wheelContext, setWheelContext] = useState<WheelContext | null>(null);
  const [isCompactLayout, setIsCompactLayout] = useState(false);
  // Locks scroll + listens for escape while a wheel is open.
  useEffect(() => {
    if (!wheelContext) {
      document.body.style.overflow = '';
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setWheelContext(null);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEsc);
    };
  }, [wheelContext]);
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const evaluateWidth = () => {
      const width = wrapperRef.current?.clientWidth ?? window.innerWidth ?? 0;
      setIsCompactLayout(width <= 720);
    };
    evaluateWidth();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', evaluateWidth);
      return () => window.removeEventListener('resize', evaluateWidth);
    }
    if (!wrapperRef.current) {
      return;
    }
    const observer = new ResizeObserver(() => evaluateWidth());
    observer.observe(wrapperRef.current);
    return () => {
      observer.disconnect();
    };
  }, []);
  const formatDisplayName = useCallback(
    (name: string): string => {
      if (!isCompactLayout) {
        return name;
      }
      const trimmed = name.trim();
      if (trimmed.length <= 3) {
        return trimmed.toUpperCase();
      }
      return trimmed.slice(0, 3).toUpperCase();
    },
    [isCompactLayout]
  );
  // Aggregates penalties per type and total per player for UI.
  const penaltyData = useMemo(() => {
    const perType = players.map(() => ({
      misplay: 0,
      okeyToOpponent: 0,
      usefulTile: 0,
      finisher: 0
    }));
    const sums = players.map(() => 0);
    Object.entries(roundPenalties).forEach(([, playerMap]) => {
      Object.entries(playerMap).forEach(([playerIdxString, entries]) => {
        const playerIndex = Number(playerIdxString);
        entries.forEach((entry) => {
          perType[playerIndex][entry.type] =
            (perType[playerIndex][entry.type] ?? 0) + entry.value;
          sums[playerIndex] += entry.value;
        });
      });
    });
    return { perType, sums };
  }, [players, roundPenalties]);

  const { perType: penaltyPerType, sums: penaltySums } = penaltyData;

  // Combines base score with penalty totals for overall ranking.
  const totals = useMemo(() => {
    return players.map((player, playerIndex) => {
      const scoreSum = rounds.reduce(
        (acc, round) => acc + (round.scores[playerIndex] ?? 0),
        0
      );
      return scoreSum + (penaltySums[playerIndex] ?? 0);
    });
  }, [players, rounds, penaltySums]);
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
  // --- Player management handlers ---
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
  const handleCompactRename = useCallback(
    (playerId: string) => {
      if (typeof window === 'undefined') {
        return;
      }
      const currentPlayer = players.find((player) => player.id === playerId);
      const nextName = window.prompt(
        'Rename player',
        currentPlayer?.name ?? ''
      );
      if (nextName && nextName.trim().length > 0) {
        handleRenamePlayer(playerId, nextName.trim());
      }
    },
    [players, handleRenamePlayer]
  );
  // --- Score mutations ---
  const updateScoreValue = useCallback(
    (roundIndex: number, playerIndex: number, nextValue: number) => {
      const sanitized = sanitizeScoreInput(nextValue);
      setRounds((prev) =>
        prev.map((round, index) =>
          index === roundIndex
            ? {
                ...round,
                scores: round.scores.map((score, idx) =>
                  idx === playerIndex ? sanitized : score
                )
              }
            : round
        )
      );
      if (sanitized !== 0) {
        markGameStarted();
      }
    },
    [markGameStarted]
  );

  const adjustScoreValue = useCallback(
    (roundIndex: number, playerIndex: number, delta: number) => {
      if (delta === 0) {
        return;
      }
      setRounds((prev) =>
        prev.map((round, index) =>
          index === roundIndex
            ? {
                ...round,
                scores: round.scores.map((score, idx) =>
                  idx === playerIndex
                    ? sanitizeScoreInput((score ?? 0) + delta)
                    : score
                )
              }
            : round
        )
      );
      markGameStarted();
    },
    [markGameStarted]
  );

  // --- Wheel context openers ---
  const openScoreWheel = useCallback(
    (roundIndex: number, playerIndex: number) => {
      const initialValue = rounds[roundIndex]?.scores[playerIndex] ?? 0;
      setWheelContext({
        kind: 'score',
        roundIndex,
        playerIndex,
        initialValue
      });
    },
    [rounds]
  );

  const openPenaltyWheel = useCallback(
    (roundIndex: number, playerIndex: number, penaltyType: PenaltyId) => {
      setWheelContext({
        kind: 'penalty',
        penaltyType,
        roundIndex,
        playerIndex,
        initialValue: 0
      });
    },
    []
  );

  // Records penalty entries per cell and updates aggregated totals.
  const applyPenaltyValue = useCallback(
    (
      roundIndex: number,
      playerIndex: number,
      penaltyType: PenaltyId,
      rawValue: number
    ) => {
      const sanitized = sanitizeScoreInput(rawValue);
      if (sanitized === 0) {
        return;
      }
      const round = rounds[roundIndex];
      if (!round) {
        return;
      }
      const roundId = round.id;
      setRoundPenalties((prev) => {
        const roundEntries = { ...(prev[roundId] ?? {}) };
        const playerEntries = [...(roundEntries[playerIndex] ?? [])];
        playerEntries.push({
          id: makeId(),
          type: penaltyType,
          value: sanitized
        });
        roundEntries[playerIndex] = playerEntries;
        return { ...prev, [roundId]: roundEntries };
      });
      const playerId = players[playerIndex]?.id;
      if (playerId) {
        setPenalties((prev) => ({
          ...prev,
          [playerId]: {
            ...prev[playerId],
            [penaltyType]: (prev[playerId]?.[penaltyType] ?? 0) + sanitized
          }
        }));
      }
    },
    [players, rounds]
  );

  // --- Penalty removal & round lifecycle ---
  /**
   * Removes a single penalty chip from both the per-round map and the aggregate
   * penalty ledger when the inline "×" button is clicked. This keeps the inline
   * tags, summary view, and totals in sync while preventing negative counts.
   */
  const handleRemovePenaltyEntry = useCallback(
    (
      roundIndex: number,
      playerIndex: number,
      entryId: string,
      entryValue: number,
      penaltyType: PenaltyId
    ) => {
      const round = rounds[roundIndex];
      if (!round) {
        return;
      }
      const roundId = round.id;
      setRoundPenalties((prev) => {
        const roundEntries = { ...(prev[roundId] ?? {}) };
        const playerEntries = (roundEntries[playerIndex] ?? []).filter(
          (entry) => entry.id !== entryId
        );
        roundEntries[playerIndex] = playerEntries;
        return { ...prev, [roundId]: roundEntries };
      });
      const playerId = players[playerIndex]?.id;
      if (playerId) {
        setPenalties((prev) => ({
          ...prev,
          [playerId]: {
            ...prev[playerId],
            [penaltyType]: Math.max(
              0,
              (prev[playerId]?.[penaltyType] ?? 0) - entryValue
            )
          }
        }));
      }
    },
    [players, rounds]
  );

  /**
   * Appends a fresh round scaffold sized to the current player count. Triggered
   * by the "+ Add round" button so players can keep extending a running game.
   */
  const handleAddRound = useCallback(() => {
    setRounds((prev) => [...prev, createEmptyRound(players.length)]);
  }, [players.length]);
  /**
   * Deletes the selected round card unless it is the lone remaining round. Used
   * by the trash icon rendered within each round row to prune mistakes.
   */
  const handleDeleteRound = useCallback((roundId: string) => {
    setRounds((prev) =>
      prev.length > 1 ? prev.filter((round) => round.id !== roundId) : prev
    );
  }, []);
  /**
   * Locks the player configuration and pushes the view into "in-progress" mode.
   * Activated by the Start button so we know when to disable player controls.
   */
  const handleStartGame = useCallback(() => {
    setGameStarted(true);
  }, []);
  /**
   * Resets the board to a pristine state: wipes rounds, penalties, and the
   * per-round penalty map, and unlocks player controls. Used by the Reset CTA.
   */
  const handleResetGame = useCallback(() => {
    setRounds([createEmptyRound(players.length)]);
    setPenalties(syncPenaltyState(players, {}));
    setRoundPenalties({});
    setGameStarted(false);
  }, [players]);
  const disablePlayerControls = gameStarted;
  /**
   * Flattens the per-round penalty entries into totals per player/per penalty
   * type. Drives the "Penalty Summary" section so users see cumulative impact.
   */
  const penaltySummary = useMemo(() => {
    const totals = players.map(() => ({
      misplay: 0,
      okeyToOpponent: 0,
      usefulTile: 0,
      finisher: 0
    }));
    Object.entries(roundPenalties).forEach(([, playerMap]) => {
      Object.entries(playerMap).forEach(([playerIdxString, entries]) => {
        const playerIndex = Number(playerIdxString);
        entries.forEach((entry) => {
          const bucket = totals[playerIndex];
          bucket[entry.type] = (bucket[entry.type] ?? 0) + entry.value;
        });
      });
    });
    return totals;
  }, [players, roundPenalties]);
  return (
    <div
      ref={wrapperRef}
      className={`scoreboard-wrapper${
        isCompactLayout ? ' scoreboard-wrapper--compact' : ''
      }`}
    >
      <div
        className={`scoreboard-card${wheelContext ? ' blurred' : ''}`}
        role="table"
        aria-label={title}
      >
        <header className="scoreboard-header">
          <div className="scoreboard-header-info">
            <h2 className="scoreboard-title">{title}</h2>
            <p className="scoreboard-subtitle">
              Track up to four players — lowest score wins.
            </p>
          </div>
          <div className="scoreboard-actions">
            <GlassButton onClick={handleStartGame} disabled={gameStarted}>
              {gameStarted ? 'Game Locked' : 'Start Game'}
            </GlassButton>
            <GlassButton tone="secondary" onClick={handleResetGame}>
              Reset
            </GlassButton>
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
                {isCompactLayout ? (
                  <button
                    type="button"
                    className="scoreboard-player-compact-button"
                    onClick={() => handleCompactRename(player.id)}
                    disabled={disablePlayerControls}
                    aria-label={`Rename ${player.name}`}
                  >
                    {formatDisplayName(player.name)}
                  </button>
                ) : (
                  <input
                    aria-label={`Rename ${player.name}`}
                    value={player.name}
                    onChange={(event) =>
                      handleRenamePlayer(player.id, event.target.value)
                    }
                    className="scoreboard-player-input"
                  />
                )}
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
              {players.map((_, playerIndex) => {
                const value = round.scores[playerIndex] ?? 0;
                const cellPenalties =
                  roundPenalties[round.id]?.[playerIndex] ?? [];
                const penaltySum = cellPenalties.reduce(
                  (acc, entry) => acc + entry.value,
                  0
                );
                return (
                  <div
                    key={`${round.id}-${playerIndex}`}
                    className="scoreboard-score-cell"
                    role="button"
                    tabIndex={0}
                    aria-label={`Round ${roundIndex + 1} score for ${
                      players[playerIndex].name
                    }`}
                    onClick={() => openScoreWheel(roundIndex, playerIndex)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openScoreWheel(roundIndex, playerIndex);
                      } else if (event.key === 'ArrowUp') {
                        event.preventDefault();
                        adjustScoreValue(roundIndex, playerIndex, 1);
                      } else if (event.key === 'ArrowDown') {
                        event.preventDefault();
                        adjustScoreValue(roundIndex, playerIndex, -1);
                      }
                    }}
                  >
                    <span className="scoreboard-score-display">{value}</span>
                    <div className="scoreboard-penalty-symbols">
                      {PENALTY_TYPES.map((penalty) => (
                        <button
                          key={penalty.id}
                          type="button"
                          className="scoreboard-penalty-symbol"
                          aria-label={`${penalty.label} penalty`}
                          onClick={(event) => {
                            event.stopPropagation();
                            openPenaltyWheel(
                              roundIndex,
                              playerIndex,
                              penalty.id
                            );
                          }}
                        >
                          {penalty.icon}
                        </button>
                      ))}
                    </div>
                    {cellPenalties.length > 0 && (
                      <>
                        <div className="scoreboard-penalty-tags">
                          {cellPenalties.map((entry) => {
                            const penaltyMeta = PENALTY_TYPES.find(
                              (penalty) => penalty.id === entry.type
                            );
                            return (
                              <div
                                key={entry.id}
                                className="scoreboard-penalty-tag"
                              >
                                <span>
                                  {penaltyMeta?.icon} {entry.value}
                                </span>
                                <button
                                  type="button"
                                  aria-label="Remove penalty"
                                  onClick={(
                                    event: MouseEvent<HTMLButtonElement>
                                  ) => {
                                    event.stopPropagation();
                                    handleRemovePenaltyEntry(
                                      roundIndex,
                                      playerIndex,
                                      entry.id,
                                      entry.value,
                                      entry.type
                                    );
                                  }}
                                >
                                  ×
                                </button>
                              </div>
                            );
                          })}
                        </div>
                        <div className="scoreboard-penalty-total">
                          Total: {value + penaltySum}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
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
            <h3 className="scoreboard-penalties-title">Penalty Summary</h3>
            <span className="scoreboard-penalties-description">
              Totals per player for each penalty type
            </span>
          </div>
          <div className="scoreboard-penalty-summary">
            {PENALTY_TYPES.map((penalty) => (
              <div key={penalty.id} className="scoreboard-penalty-summary-row">
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
                <div className="scoreboard-penalty-summary-values">
                  {players.map((player, index) => (
                    <div
                      key={`${player.id}-${penalty.id}`}
                      className="scoreboard-penalty-summary-item"
                      style={{
                        borderColor: getAccent(index)
                      }}
                    >
                      <span>{formatDisplayName(player.name)}</span>
                      <strong>
                        {penaltySummary[index]?.[penalty.id] ?? 0}
                      </strong>
                    </div>
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
                  <div className="scoreboard-total-player">
                    {formatDisplayName(player.name)}
                  </div>
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

      {wheelContext && (
        <WheelOverlay
          player={players[wheelContext.playerIndex]}
          roundLabel={`Round ${wheelContext.roundIndex + 1}`}
          contextLabel={
            wheelContext.kind === 'score'
              ? 'Adjust score'
              : PENALTY_TYPES.find(
                  (penalty) => penalty.id === wheelContext.penaltyType
                )?.label ?? 'Penalty'
          }
          initialValue={wheelContext.initialValue}
          onClose={() => setWheelContext(null)}
          onConfirm={(nextValue) => {
            if (wheelContext.kind === 'score') {
              updateScoreValue(
                wheelContext.roundIndex,
                wheelContext.playerIndex,
                nextValue
              );
            } else {
              applyPenaltyValue(
                wheelContext.roundIndex,
                wheelContext.playerIndex,
                wheelContext.penaltyType,
                nextValue
              );
            }
          }}
        />
      )}
    </div>
  );
}

interface WheelOverlayProps {
  player: Player;
  roundLabel: string;
  contextLabel?: string;
  initialValue: number;
  onClose: () => void;
  onConfirm: (value: number) => void;
}

// === WheelOverlay ===
/**
 * Internal-only modal used by ScoreBoard for both score and penalty editing.
 * Provides scrolling/keyboard gestures, focus trapping, and surfaces selection
 * updates via callbacks so parent state remains the source of truth.
 */
function WheelOverlay({
  player,
  roundLabel,
  contextLabel,
  initialValue,
  onClose,
  onConfirm
}: WheelOverlayProps): ReactElement {
  /**
   * Local selection state mirrors the wheel's highlighted number while the
   * modal is open. Updated via scroll, keyboard, or clicking alternative values.
   */
  const [selection, setSelection] = useState(initialValue);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelection(initialValue);
  }, [initialValue]);

  useEffect(() => {
    modalRef.current?.focus();
  }, []);

  const adjustSelection = useCallback((delta: number) => {
    if (delta === 0) {
      return;
    }
    setSelection((prev) => sanitizeScoreInput(prev + delta));
  }, []);

  const handleWheel = useCallback(
    (event: WheelEvent<HTMLDivElement>) => {
      event.preventDefault();
      const direction = event.deltaY < 0 ? 1 : event.deltaY > 0 ? -1 : 0;
      adjustSelection(direction);
    },
    [adjustSelection]
  );

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        adjustSelection(1);
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        adjustSelection(-1);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        onConfirm(selection);
        onClose();
      } else if (event.key === 'Escape') {
        onClose();
      }
    },
    [adjustSelection, selection, onClose, onConfirm]
  );

  const handleConfirm = useCallback(() => {
    onConfirm(selection);
    onClose();
  }, [selection, onConfirm, onClose]);

  const previewValues = useMemo(
    () => createPreviewValues(selection),
    [selection]
  );

  return (
    <div
      className="scoreboard-wheel-overlay"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="scoreboard-wheel-modal"
        tabIndex={-1}
        ref={modalRef}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <header className="scoreboard-wheel-header">
          <div>
            <p className="scoreboard-wheel-label">{roundLabel}</p>
            <h3 className="scoreboard-wheel-player">{player.name}</h3>
            {contextLabel && (
              <p className="scoreboard-wheel-context">{contextLabel}</p>
            )}
          </div>
          <button
            type="button"
            aria-label="Close score selector"
            className="scoreboard-wheel-close"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div
          className="scoreboard-wheel"
          onWheel={handleWheel}
          role="listbox"
          aria-activedescendant="wheel-value-active"
        >
          {previewValues.map((wheelValue, index) => {
            const isCurrent =
              index === Math.floor(previewValues.length / 2) ||
              wheelValue === selection;
            return (
              <button
                type="button"
                key={`${wheelValue}-${index}`}
                id={isCurrent ? 'wheel-value-active' : undefined}
                className={`scoreboard-wheel-item${
                  isCurrent ? ' current' : ''
                }`}
                onClick={() =>
                  isCurrent ? handleConfirm() : setSelection(wheelValue)
                }
              >
                {wheelValue}
              </button>
            );
          })}
        </div>
        <p className="scoreboard-wheel-hint">
          Scroll or use ↑/↓ to move through numbers. Click the highlighted value
          to set it.
        </p>
      </div>
    </div>
  );
}

/**
 * Builds the +/- preview series shown around the focused wheel value. Internal
 * helper scoped to WheelOverlay so our modal logic stays co-located.
 */
function createPreviewValues(current: number): number[] {
  const offsets = [-2, -1, 0, 1, 2];
  return offsets.map((offset) => sanitizeScoreInput(current + offset));
}
