import Head from 'next/head';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent
} from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ScoreBoard,
  type RoundSubmitPayload,
  type ScoreBoardProps
} from 'ui-kit';
import { AuthGate } from '../lib/auth/AuthGate';
import { useAuth } from '../lib/auth/AuthContext';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { ApiClientError } from '../lib/api/httpClient';
import {
  addGameRound,
  completeGame,
  createGame,
  fetchActiveGame,
  updateGamePlayers
} from '../lib/api/games';
import type {
  AddRoundInput,
  CreateGameInput,
  GameDetail,
  GamePenaltyType,
  GamePlayer,
  UpdatePlayersInput
} from '../types/games';
import styles from '../styles/dashboard-page.module.css';

const ACTIVE_GAME_QUERY_KEY = ['active-game'] as const;
const MIN_GAME_PLAYERS = 2;
const MAX_GAME_PLAYERS = 4;
const PLAYER_AUTOSAVE_DELAY_MS = 650;

type ScoreboardPlayerDraft = Parameters<
  NonNullable<ScoreBoardProps['onPlayerChange']>
>[0];

// === Dashboard data mappers ===

/**
 * @description Returns players sorted by backend seat order.
 * @param players - Unsorted game player records.
 * @returns Player records in ascending `seatIndex` order.
 * @Used_by
 *   - Dashboard scoreboard hydration and player-mutation payload mapping.
 * @Side_effects
 *   - None.
 */
function sortPlayersBySeat(players: GamePlayer[]): GamePlayer[] {
  return [...players].sort((left, right) => left.seatIndex - right.seatIndex);
}

/**
 * @description Builds a stable player signature for change detection and debounce dedupe.
 * @param players - Ordered players carrying id, displayName, and seat index.
 * @returns Pipe-delimited signature string representing the current player setup.
 * @Used_by
 *   - Debounced player autosave flow in `DashboardPage`.
 * @Side_effects
 *   - None.
 */
function buildPlayerSignature(
  players: Array<{ id: string; displayName: string; seatIndex: number }>
): string {
  return players
    .map((player) => `${player.id}:${player.displayName}:${player.seatIndex}`)
    .join('|');
}

/**
 * @description Converts backend rounds into `ScoreBoard` seed rows and appends one draft row for the next round.
 * @param game - Active game payload from the dashboard query.
 * @param orderedPlayers - Players sorted by seat index.
 * @returns ScoreBoard initial rounds payload, or `undefined` to let ScoreBoard create a blank first row.
 * @Used_by
 *   - `DashboardPage` scoreboard props.
 * @Side_effects
 *   - None.
 */
function buildScoreboardRounds(
  game: GameDetail | null,
  orderedPlayers: GamePlayer[]
): Array<{ scores: number[] }> | undefined {
  if (!game || game.rounds.length === 0) {
    return undefined;
  }

  const mappedRounds = [...game.rounds]
    .sort((left, right) => left.index - right.index)
    .map((round) => {
      const scoreByPlayer = new Map(
        round.scores.map((score) => [score.playerId, score.points] as const)
      );
      return {
        scores: orderedPlayers.map(
          (player) => scoreByPlayer.get(player.id) ?? 0
        )
      };
    });

  return [...mappedRounds, { scores: orderedPlayers.map(() => 0) }];
}

/**
 * @description Maps backend cumulative penalty totals into the per-player seed format expected by `ScoreBoard`.
 * @param game - Active game payload from the dashboard query.
 * @param orderedPlayers - Players sorted by seat index.
 * @returns Penalty seed array aligned to player order.
 * @Used_by
 *   - `DashboardPage` scoreboard props.
 * @Side_effects
 *   - None.
 */
function buildScoreboardPenalties(
  game: GameDetail | null,
  orderedPlayers: GamePlayer[]
): Array<Partial<Record<GamePenaltyType, number>>> | undefined {
  if (!game) {
    return undefined;
  }

  return orderedPlayers.map((player) => game.penalties[player.id] ?? {});
}

/**
 * @description Creates the default player name draft used by the "Start new game" modal.
 * @param displayName - Authenticated user's display name used for seat 1 fallback.
 * @returns Four-seat player draft array.
 * @Used_by
 *   - Dashboard new-game modal state initialization/reset.
 * @Side_effects
 *   - None.
 */
function createPlayerDraft(displayName?: string): string[] {
  const first = displayName?.trim() || 'You';
  return [first, 'Player 2', 'Player 3', 'Player 4'];
}

/**
 * @description Converts unknown errors into a user-facing dashboard message.
 * @param error - Unknown thrown value from query/mutation paths.
 * @returns Safe message string for inline dashboard alerts.
 * @Used_by
 *   - Query and mutation error banners in `DashboardPage`.
 * @Side_effects
 *   - None.
 */
function toDashboardErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Something went wrong. Please try again.';
}

// === Dashboard route ===

/**
 * @description Renders the authenticated dashboard with active-game query wiring, editable scoreboard, and quick actions.
 * @returns Protected dashboard view with loading/empty/error states and game mutations.
 * @Used_by
 *   - Navigation to `/dashboard` after successful auth flows.
 * @Side_effects
 *   - Performs game query/mutation network calls and debounced player autosave operations.
 */
export default function DashboardPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isNewGameModalOpen, setIsNewGameModalOpen] = useState(false);
  const [newGameTitle, setNewGameTitle] = useState('');
  const [newGamePlayers, setNewGamePlayers] = useState<string[]>(() =>
    createPlayerDraft(user?.displayName)
  );
  const [newGameError, setNewGameError] = useState<string | null>(null);
  const [isPlayerAutosaveQueued, setIsPlayerAutosaveQueued] = useState(false);
  const playerAutosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const activeGameQuery = useQuery({
    queryKey: ACTIVE_GAME_QUERY_KEY,
    queryFn: fetchActiveGame
  });

  const activeGame = activeGameQuery.data ?? null;
  const orderedPlayers = useMemo(
    () => sortPlayersBySeat(activeGame?.players ?? []),
    [activeGame?.players]
  );
  const serverPlayerSignature = useMemo(
    () => buildPlayerSignature(orderedPlayers),
    [orderedPlayers]
  );

  const invalidateActiveGame = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ACTIVE_GAME_QUERY_KEY });
  }, [queryClient]);

  const createGameMutation = useMutation({
    mutationFn: createGame,
    onSuccess: async () => {
      setIsNewGameModalOpen(false);
      await invalidateActiveGame();
    }
  });

  const addRoundMutation = useMutation({
    mutationFn: ({ gameId, payload }: { gameId: string; payload: AddRoundInput }) =>
      addGameRound(gameId, payload),
    onSuccess: async () => {
      await invalidateActiveGame();
    }
  });

  const updatePlayersMutation = useMutation({
    mutationFn: ({
      gameId,
      payload
    }: {
      gameId: string;
      payload: UpdatePlayersInput;
    }) => updateGamePlayers(gameId, payload),
    onSettled: async () => {
      setIsPlayerAutosaveQueued(false);
      await invalidateActiveGame();
    }
  });

  const completeGameMutation = useMutation({
    mutationFn: completeGame,
    onSuccess: async () => {
      await invalidateActiveGame();
    }
  });

  useEffect(() => {
    return () => {
      if (playerAutosaveTimerRef.current) {
        clearTimeout(playerAutosaveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (playerAutosaveTimerRef.current) {
      clearTimeout(playerAutosaveTimerRef.current);
      playerAutosaveTimerRef.current = null;
    }
    setIsPlayerAutosaveQueued(false);
  }, [activeGame?.id]);

  const openNewGameModal = useCallback(() => {
    setNewGameError(null);
    setNewGameTitle('');
    setNewGamePlayers(createPlayerDraft(user?.displayName));
    setIsNewGameModalOpen(true);
  }, [user?.displayName]);

  const closeNewGameModal = useCallback(() => {
    setIsNewGameModalOpen(false);
  }, []);

  const handleAddDraftPlayer = useCallback(() => {
    setNewGamePlayers((previous) => {
      if (previous.length >= MAX_GAME_PLAYERS) {
        return previous;
      }
      return [...previous, `Player ${previous.length + 1}`];
    });
  }, []);

  const handleRemoveDraftPlayer = useCallback((index: number) => {
    setNewGamePlayers((previous) => {
      if (previous.length <= MIN_GAME_PLAYERS) {
        return previous;
      }
      return previous.filter((_, currentIndex) => currentIndex !== index);
    });
  }, []);

  const handleCreateGame = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const players = newGamePlayers
        .map((name) => name.trim())
        .filter((name) => name.length > 0)
        .slice(0, MAX_GAME_PLAYERS);

      if (players.length < MIN_GAME_PLAYERS) {
        setNewGameError('Enter at least two player names.');
        return;
      }

      const payload: CreateGameInput = {
        title: newGameTitle.trim() || undefined,
        players: players.map((displayName, index) => ({
          displayName,
          userId: index === 0 ? user?.id : undefined
        }))
      };

      try {
        await createGameMutation.mutateAsync(payload);
      } catch (error) {
        setNewGameError(toDashboardErrorMessage(error));
      }
    },
    [newGamePlayers, newGameTitle, createGameMutation, user?.id]
  );

  const handleRoundSubmit = useCallback(
    (payload: RoundSubmitPayload) => {
      if (!activeGame || addRoundMutation.isPending) {
        return;
      }

      const mappedScores = payload.scores
        .map((score, index) => {
          const backendPlayer = orderedPlayers[index];
          if (!backendPlayer) {
            return null;
          }
          return {
            playerId: backendPlayer.id,
            points: Math.trunc(score.points)
          };
        })
        .filter(
          (
            score
          ): score is {
            playerId: string;
            points: number;
          } => score !== null
        );

      if (mappedScores.length !== orderedPlayers.length) {
        return;
      }

      const uiIndexByPlayerId = new Map(
        payload.scores.map((score, index) => [score.playerId, index] as const)
      );

      const mappedPenalties = payload.penalties
        .map((penalty) => {
          const playerIndex = uiIndexByPlayerId.get(penalty.playerId);
          const backendPlayer =
            typeof playerIndex === 'number'
              ? orderedPlayers[playerIndex]
              : undefined;
          if (!backendPlayer) {
            return null;
          }

          const sanitizedValue = Math.max(
            0,
            Math.trunc(Math.abs(penalty.value))
          );
          if (sanitizedValue === 0) {
            return null;
          }

          return {
            playerId: backendPlayer.id,
            type: penalty.type,
            value: sanitizedValue
          };
        })
        .filter(
          (
            penalty
          ): penalty is {
            playerId: string;
            type: GamePenaltyType;
            value: number;
          } => penalty !== null
        );

      addRoundMutation.mutate({
        gameId: activeGame.id,
        payload: {
          scores: mappedScores,
          penalties: mappedPenalties.length ? mappedPenalties : undefined
        }
      });
    },
    [activeGame, addRoundMutation, orderedPlayers]
  );

  const handlePlayerAutosave = useCallback(
    (scoreboardPlayers: ScoreboardPlayerDraft) => {
      if (!activeGame || !activeGame.isOwner || orderedPlayers.length === 0) {
        return;
      }

      const mappedPlayers = scoreboardPlayers
        .map((player, index) => {
          const backendPlayer = orderedPlayers[index];
          if (!backendPlayer) {
            return null;
          }
          return {
            id: backendPlayer.id,
            displayName: player.displayName.trim() || backendPlayer.displayName,
            seatIndex: index
          };
        })
        .filter(
          (
            player
          ): player is {
            id: string;
            displayName: string;
            seatIndex: number;
          } => player !== null
        );

      if (mappedPlayers.length !== orderedPlayers.length) {
        return;
      }

      const nextSignature = buildPlayerSignature(mappedPlayers);
      if (nextSignature === serverPlayerSignature) {
        return;
      }

      if (playerAutosaveTimerRef.current) {
        clearTimeout(playerAutosaveTimerRef.current);
      }

      setIsPlayerAutosaveQueued(true);
      playerAutosaveTimerRef.current = setTimeout(() => {
        playerAutosaveTimerRef.current = null;
        updatePlayersMutation.mutate({
          gameId: activeGame.id,
          payload: { players: mappedPlayers }
        });
      }, PLAYER_AUTOSAVE_DELAY_MS);
    },
    [activeGame, orderedPlayers, serverPlayerSignature, updatePlayersMutation]
  );

  const handleCompleteGame = useCallback(async () => {
    if (!activeGame || completeGameMutation.isPending) {
      return;
    }

    try {
      await completeGameMutation.mutateAsync(activeGame.id);
    } catch {
      // Mutations expose their own error state; no extra handling required here.
    }
  }, [activeGame, completeGameMutation]);

  const gameStats = useMemo(() => {
    if (!activeGame) {
      return null;
    }

    const penaltyCount = Object.values(activeGame.penalties).reduce(
      (sum, byType) =>
        sum +
        Object.values(byType).reduce(
          (typeTotal, count) => typeTotal + (count ?? 0),
          0
        ),
      0
    );

    const combinedTotal = Object.values(activeGame.totals).reduce(
      (sum, value) => sum + value,
      0
    );

    return {
      roundCount: activeGame.rounds.length,
      playerCount: activeGame.players.length,
      penaltyCount,
      leaderName: activeGame.leader?.displayName ?? 'No leader yet',
      leaderTotal: activeGame.leader?.total ?? 0,
      combinedTotal
    };
  }, [activeGame]);

  const scoreboardInitialPlayers = useMemo(
    () => orderedPlayers.map((player) => player.displayName),
    [orderedPlayers]
  );
  const scoreboardInitialRounds = useMemo(
    () => buildScoreboardRounds(activeGame, orderedPlayers),
    [activeGame, orderedPlayers]
  );
  const scoreboardInitialPenalties = useMemo(
    () => buildScoreboardPenalties(activeGame, orderedPlayers),
    [activeGame, orderedPlayers]
  );
  const scoreboardKey = useMemo(() => {
    if (!activeGame) {
      return 'no-active-game';
    }
    return [
      activeGame.id,
      activeGame.rounds.length,
      buildPlayerSignature(orderedPlayers),
      JSON.stringify(activeGame.penalties)
    ].join(':');
  }, [activeGame, orderedPlayers]);

  const activeMutationError =
    createGameMutation.error ||
    addRoundMutation.error ||
    updatePlayersMutation.error ||
    completeGameMutation.error;
  const syncLabel = addRoundMutation.isPending
    ? 'Saving latest round...'
    : updatePlayersMutation.isPending || isPlayerAutosaveQueued
      ? 'Autosaving player edits...'
      : activeGameQuery.isFetching
        ? 'Refreshing game state...'
        : 'All changes synced.';

  return (
    <>
      <Head>
        <title>Okey Score • Dashboard</title>
      </Head>
      <AuthGate loadingFallback={null}>
        <DashboardLayout
          title="Dashboard"
          subtitle="Live active game tracking, quick actions, and autosynced scoreboard edits."
        >
          <div className={styles.stack}>
            <section className={styles.quickActions}>
              <div>
                <p className={styles.quickActionsEyebrow}>Quick Actions</p>
                <h3 className={styles.quickActionsTitle}>Run your next move</h3>
              </div>
              <div className={styles.quickActionsButtons}>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={openNewGameModal}
                  disabled={createGameMutation.isPending}
                >
                  {createGameMutation.isPending ? 'Starting...' : 'Start new game'}
                </button>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={handleCompleteGame}
                  disabled={!activeGame || completeGameMutation.isPending}
                >
                  {completeGameMutation.isPending ? 'Completing...' : 'Mark complete'}
                </button>
              </div>
            </section>

            {activeMutationError ? (
              <p className={styles.errorBanner}>
                {toDashboardErrorMessage(activeMutationError)}
              </p>
            ) : null}

            {activeGameQuery.isLoading ? (
              <article className={styles.stateCard}>
                <p className={styles.stateEyebrow}>Loading</p>
                <h3 className={styles.stateTitle}>Fetching active game</h3>
                <p className={styles.stateCopy}>
                  Pulling your latest game data and restoring the scoreboard.
                </p>
              </article>
            ) : null}

            {activeGameQuery.isError ? (
              <article className={styles.stateCard}>
                <p className={styles.stateEyebrow}>Error</p>
                <h3 className={styles.stateTitle}>Unable to load the dashboard</h3>
                <p className={styles.stateCopy}>
                  {toDashboardErrorMessage(activeGameQuery.error)}
                </p>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={() => activeGameQuery.refetch()}
                >
                  Retry
                </button>
              </article>
            ) : null}

            {!activeGameQuery.isLoading &&
            !activeGameQuery.isError &&
            !activeGame ? (
              <article className={styles.stateCard}>
                <p className={styles.stateEyebrow}>No active game</p>
                <h3 className={styles.stateTitle}>Start your next table</h3>
                <p className={styles.stateCopy}>
                  Open a new game to unlock live scoring, autosave, and quick completion.
                </p>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={openNewGameModal}
                >
                  Start new game
                </button>
              </article>
            ) : null}

            {activeGame && gameStats ? (
              <>
                <section className={styles.statsGrid}>
                  <article className={styles.statCard}>
                    <p className={styles.statLabel}>Rounds</p>
                    <p className={styles.statValue}>{gameStats.roundCount}</p>
                  </article>
                  <article className={styles.statCard}>
                    <p className={styles.statLabel}>Leader</p>
                    <p className={styles.statValue}>{gameStats.leaderName}</p>
                    <p className={styles.statMeta}>
                      Total {gameStats.leaderTotal}
                    </p>
                  </article>
                  <article className={styles.statCard}>
                    <p className={styles.statLabel}>Penalties</p>
                    <p className={styles.statValue}>{gameStats.penaltyCount}</p>
                  </article>
                  <article className={styles.statCard}>
                    <p className={styles.statLabel}>Combined Total</p>
                    <p className={styles.statValue}>{gameStats.combinedTotal}</p>
                    <p className={styles.statMeta}>
                      Across {gameStats.playerCount} players
                    </p>
                  </article>
                </section>

                <div className={styles.syncBar}>
                  <span className={styles.syncDot} aria-hidden />
                  <p className={styles.syncCopy}>{syncLabel}</p>
                </div>

                <div className={styles.boardShell}>
                  <ScoreBoard
                    key={scoreboardKey}
                    title={activeGame.title || 'Active Game'}
                    minPlayers={orderedPlayers.length}
                    maxPlayers={orderedPlayers.length}
                    initialPlayers={scoreboardInitialPlayers}
                    initialRounds={scoreboardInitialRounds}
                    initialPenalties={scoreboardInitialPenalties}
                    interactionMode={activeGame.isOwner ? 'editable' : 'readonly'}
                    onRoundSubmit={
                      activeGame.isOwner ? handleRoundSubmit : undefined
                    }
                    onPlayerChange={
                      activeGame.isOwner ? handlePlayerAutosave : undefined
                    }
                  />
                </div>
              </>
            ) : null}
          </div>

          {isNewGameModalOpen ? (
            <div
              className={styles.modalBackdrop}
              role="presentation"
              onClick={(event) => {
                if (event.target === event.currentTarget) {
                  closeNewGameModal();
                }
              }}
            >
              <section
                className={styles.modalCard}
                role="dialog"
                aria-modal="true"
                aria-labelledby="new-game-title"
              >
                <header className={styles.modalHeader}>
                  <div>
                    <p className={styles.modalEyebrow}>Quick Action</p>
                    <h3 id="new-game-title" className={styles.modalTitle}>
                      Start new game
                    </h3>
                  </div>
                  <button
                    type="button"
                    className={styles.modalClose}
                    onClick={closeNewGameModal}
                  >
                    Close
                  </button>
                </header>

                <form className={styles.modalForm} onSubmit={handleCreateGame}>
                  <label className={styles.fieldLabel}>
                    Title
                    <input
                      value={newGameTitle}
                      onChange={(event) => setNewGameTitle(event.target.value)}
                      className={styles.fieldInput}
                      placeholder="Friday table"
                    />
                  </label>

                  <div className={styles.playerDraftBlock}>
                    <p className={styles.fieldLabel}>Players</p>
                    {newGamePlayers.map((name, index) => (
                      <div key={`draft-player-${index}`} className={styles.playerDraftRow}>
                        <input
                          value={name}
                          onChange={(event) =>
                            setNewGamePlayers((previous) =>
                              previous.map((item, currentIndex) =>
                                currentIndex === index
                                  ? event.target.value
                                  : item
                              )
                            )
                          }
                          className={styles.fieldInput}
                          placeholder={`Player ${index + 1}`}
                          required={index < MIN_GAME_PLAYERS}
                        />
                        <button
                          type="button"
                          className={styles.removeButton}
                          onClick={() => handleRemoveDraftPlayer(index)}
                          disabled={newGamePlayers.length <= MIN_GAME_PLAYERS}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={handleAddDraftPlayer}
                      disabled={newGamePlayers.length >= MAX_GAME_PLAYERS}
                    >
                      Add player
                    </button>
                  </div>

                  {newGameError ? (
                    <p className={styles.modalError}>{newGameError}</p>
                  ) : null}

                  <div className={styles.modalActions}>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={closeNewGameModal}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className={styles.primaryButton}
                      disabled={createGameMutation.isPending}
                    >
                      {createGameMutation.isPending
                        ? 'Creating...'
                        : 'Create game'}
                    </button>
                  </div>
                </form>
              </section>
            </div>
          ) : null}
        </DashboardLayout>
      </AuthGate>
    </>
  );
}
