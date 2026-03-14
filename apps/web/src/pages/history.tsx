import Head from 'next/head';
import { useCallback, useMemo, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { PENALTY_KINDS, type ScoreboardSnapshot } from 'domain/snapshots/scoreboard-snapshot';
import { ScoreBoard } from 'ui-kit';
import { AuthGate } from '../lib/auth/AuthGate';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { ApiClientError } from '../lib/api/httpClient';
import { fetchGameById, fetchGamesHistory } from '../lib/api/games';
import type {
  GameDetail,
  GameHistoryItem,
  GamePenaltyType
} from '../types/games';
import styles from '../styles/history-page.module.css';

const HISTORY_PAGE_SIZE = 12;
const HISTORY_QUERY_KEY = ['history-games'] as const;

type PlayerCountFilter = 'all' | '2' | '3' | '4';

// === History format and filter helpers ===

/**
 * @description Converts unknown request errors into a safe user-facing message.
 * @param error - Unknown thrown value from query paths.
 * @returns User-safe message string suitable for inline history UI alerts.
 * @Used_by
 *   - History list and modal query error banners.
 * @Side_effects
 *   - None.
 */
function toHistoryErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unable to load history right now.';
}

/**
 * @description Formats ISO date strings into a compact local date/time label.
 * @param value - ISO string from API payloads or `null`.
 * @returns Localized label string, or `-` when value is missing.
 * @Used_by
 *   - History cards and modal metadata labels.
 * @Side_effects
 *   - None.
 */
function formatDateLabel(value: string | null): string {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

/**
 * @description Applies date-range and player-count filters to loaded history items.
 * @param items - Loaded history list items (already flattened from pages).
 * @param fromDate - Inclusive lower-bound date from the filter control (`YYYY-MM-DD`).
 * @param toDate - Inclusive upper-bound date from the filter control (`YYYY-MM-DD`).
 * @param playerCountFilter - Selected player-count filter value.
 * @returns Filtered history items matching all selected controls.
 * @Used_by
 *   - `HistoryPage` list rendering and filtered count labels.
 * @Side_effects
 *   - None.
 */
function filterHistoryItems(
  items: GameHistoryItem[],
  fromDate: string,
  toDate: string,
  playerCountFilter: PlayerCountFilter
): GameHistoryItem[] {
  const fromTimestamp = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null;
  const toTimestamp = toDate ? new Date(`${toDate}T23:59:59.999`).getTime() : null;
  const requiredPlayers =
    playerCountFilter === 'all' ? null : Number(playerCountFilter);

  return items.filter((item) => {
    const playerCountMatches =
      requiredPlayers === null || item.players.length === requiredPlayers;
    if (!playerCountMatches) {
      return false;
    }

    const referenceDate = item.completedAt ?? item.createdAt;
    const timestamp = new Date(referenceDate).getTime();
    if (Number.isNaN(timestamp)) {
      return false;
    }

    if (fromTimestamp !== null && timestamp < fromTimestamp) {
      return false;
    }

    if (toTimestamp !== null && timestamp > toTimestamp) {
      return false;
    }

    return true;
  });
}

/**
 * @description Sorts game players by seat index for consistent scoreboard/historical exports.
 * @param game - Full game detail payload.
 * @returns New player array sorted in ascending seat order.
 * @Used_by
 *   - Scoreboard mapping and export helpers in the history modal.
 * @Side_effects
 *   - None.
 */
function getSeatOrderedPlayers(game: GameDetail): GameDetail['players'] {
  return [...game.players].sort((left, right) => left.seatIndex - right.seatIndex);
}

/**
 * @description Converts a game detail payload into a readonly scoreboard snapshot object.
 * @param game - Full game detail payload from `GET /games/:id`.
 * @returns Domain-compatible snapshot for readonly replay and JSON exports.
 * @Used_by
 *   - History modal readonly scoreboard and JSON export builder.
 * @Side_effects
 *   - None.
 */
function buildSnapshotFromGame(game: GameDetail): ScoreboardSnapshot {
  const players = getSeatOrderedPlayers(game);
  const rounds = [...game.rounds].sort((left, right) => left.index - right.index);

  return {
    players: players.map((player) => ({
      id: player.id,
      name: player.displayName,
      seatIndex: player.seatIndex,
      userId: player.userId,
      avatarColor: player.avatarColor ?? null
    })),
    rounds: rounds.map((round, index) => {
      const scoreMap = new Map(round.scores.map((score) => [score.playerId, score.points]));
      return {
        id: round.id,
        round: index + 1,
        scores: players.map((player) => ({
          playerId: player.id,
          points: scoreMap.get(player.id) ?? 0
        }))
      };
    }),
    penalties: game.penalties,
    totals: game.totals,
    started: rounds.length > 0
  };
}

/**
 * @description Creates CSV content for a historical game export with metadata and per-round rows.
 * @param game - Full game detail payload selected in the history modal.
 * @returns CSV text string ready to download as a file.
 * @Used_by
 *   - "Export CSV" modal action.
 * @Side_effects
 *   - None.
 */
function buildGameCsv(game: GameDetail): string {
  const players = getSeatOrderedPlayers(game);
  const rounds = [...game.rounds].sort((left, right) => left.index - right.index);
  const rows: string[][] = [];

  rows.push(['Game ID', game.id]);
  rows.push(['Title', game.title || 'Untitled Game']);
  rows.push(['Status', game.status]);
  rows.push(['Started At', game.startedAt]);
  rows.push(['Completed At', game.completedAt ?? '']);
  rows.push([]);

  rows.push(['Seat', 'Player ID', 'Name', 'Total']);
  players.forEach((player) => {
    rows.push([
      String(player.seatIndex + 1),
      player.id,
      player.displayName,
      String(game.totals[player.id] ?? 0)
    ]);
  });
  rows.push([]);

  rows.push([
    'Round',
    'Player ID',
    'Player Name',
    'Score',
    ...PENALTY_KINDS,
    'Round Penalty Total'
  ]);

  rounds.forEach((round, roundIndex) => {
    const scoreMap = new Map(round.scores.map((score) => [score.playerId, score.points]));
    const penaltyMap = round.penalties.reduce<Record<string, Record<GamePenaltyType, number>>>(
      (acc, penalty) => {
        if (!acc[penalty.playerId]) {
          acc[penalty.playerId] = {
            MISPLAY: 0,
            OKEY_TO_OPPONENT: 0,
            USEFUL_TILE: 0,
            FINISHER: 0
          };
        }
        acc[penalty.playerId][penalty.type] += penalty.value;
        return acc;
      },
      {}
    );

    players.forEach((player) => {
      const penaltiesByType = penaltyMap[player.id] ?? {
        MISPLAY: 0,
        OKEY_TO_OPPONENT: 0,
        USEFUL_TILE: 0,
        FINISHER: 0
      };
      const penaltyTotal = PENALTY_KINDS.reduce(
        (sum, kind) => sum + (penaltiesByType[kind] ?? 0),
        0
      );
      rows.push([
        String(roundIndex + 1),
        player.id,
        player.displayName,
        String(scoreMap.get(player.id) ?? 0),
        ...PENALTY_KINDS.map((kind) => String(penaltiesByType[kind] ?? 0)),
        String(penaltyTotal)
      ]);
    });
  });

  return rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`)
        .join(',')
    )
    .join('\n');
}

/**
 * @description Triggers browser download for generated export content.
 * @param filename - Download filename with extension.
 * @param mimeType - Blob MIME type.
 * @param content - File content string.
 * @returns None.
 * @Used_by
 *   - History modal JSON and CSV export actions.
 * @Side_effects
 *   - Creates and clicks a temporary anchor element in the browser.
 */
function downloadContent(
  filename: string,
  mimeType: string,
  content: string
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * @description Builds a stable filename slug from a game title with fallback.
 * @param title - Raw game title value.
 * @returns Lowercase dash-delimited slug suitable for filenames.
 * @Used_by
 *   - History modal JSON and CSV export actions.
 * @Side_effects
 *   - None.
 */
function toFileSlug(title: string): string {
  const normalized = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return normalized || 'game';
}

// === History page ===

/**
 * @description Renders completed game history with pagination, filters, readonly replay, and export actions.
 * @returns Protected history page content inside the shared dashboard layout.
 * @Used_by
 *   - Sidebar navigation to `/history`.
 * @Side_effects
 *   - Performs paginated history and per-game detail requests; triggers file downloads from export actions.
 */
export default function HistoryPage() {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [playerCountFilter, setPlayerCountFilter] =
    useState<PlayerCountFilter>('all');
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  const historyQuery = useInfiniteQuery({
    queryKey: HISTORY_QUERY_KEY,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      fetchGamesHistory({
        status: 'COMPLETED',
        limit: HISTORY_PAGE_SIZE,
        cursor: pageParam ?? undefined
      }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined
  });

  const selectedGameQuery = useQuery({
    queryKey: ['history-game', selectedGameId],
    queryFn: () => fetchGameById(selectedGameId as string),
    enabled: Boolean(selectedGameId)
  });

  const allLoadedItems = useMemo(() => {
    const deduped = new Map<string, GameHistoryItem>();
    historyQuery.data?.pages.forEach((page) => {
      page.items.forEach((item) => {
        deduped.set(item.id, item);
      });
    });
    return Array.from(deduped.values());
  }, [historyQuery.data]);

  const filteredItems = useMemo(
    () => filterHistoryItems(allLoadedItems, fromDate, toDate, playerCountFilter),
    [allLoadedItems, fromDate, toDate, playerCountFilter]
  );

  const selectedGame = selectedGameQuery.data ?? null;
  const selectedSnapshot = useMemo(
    () => (selectedGame ? buildSnapshotFromGame(selectedGame) : null),
    [selectedGame]
  );
  const selectedSeatOrderedPlayers = useMemo(
    () => (selectedGame ? getSeatOrderedPlayers(selectedGame) : []),
    [selectedGame]
  );
  const selectedInitialRounds = useMemo(() => {
    if (!selectedSnapshot) {
      return undefined;
    }
    return selectedSnapshot.rounds.map((round) => ({
      scores: selectedSeatOrderedPlayers.map((player) => {
        const score = round.scores.find((entry) => entry.playerId === player.id);
        return score?.points ?? 0;
      })
    }));
  }, [selectedSnapshot, selectedSeatOrderedPlayers]);
  const selectedInitialPenalties = useMemo(() => {
    if (!selectedGame) {
      return undefined;
    }
    return selectedSeatOrderedPlayers.map(
      (player) => selectedGame.penalties[player.id] ?? {}
    );
  }, [selectedGame, selectedSeatOrderedPlayers]);

  const closeModal = useCallback(() => {
    setSelectedGameId(null);
    setShareFeedback(null);
  }, []);

  const handleExportJson = useCallback(() => {
    if (!selectedGame || !selectedSnapshot) {
      return;
    }
    const payload = {
      exportedAt: new Date().toISOString(),
      game: {
        id: selectedGame.id,
        title: selectedGame.title,
        status: selectedGame.status,
        startedAt: selectedGame.startedAt,
        completedAt: selectedGame.completedAt
      },
      snapshot: selectedSnapshot
    };
    const slug = toFileSlug(selectedGame.title);
    downloadContent(
      `${slug}-${selectedGame.id}-snapshot.json`,
      'application/json;charset=utf-8',
      JSON.stringify(payload, null, 2)
    );
  }, [selectedGame, selectedSnapshot]);

  const handleExportCsv = useCallback(() => {
    if (!selectedGame) {
      return;
    }
    const slug = toFileSlug(selectedGame.title);
    downloadContent(
      `${slug}-${selectedGame.id}-history.csv`,
      'text/csv;charset=utf-8',
      buildGameCsv(selectedGame)
    );
  }, [selectedGame]);

  const handleShare = useCallback(async () => {
    if (!selectedGame || typeof window === 'undefined') {
      return;
    }
    const shareUrl = `${window.location.origin}/history?game=${selectedGame.id}`;
    const shareTitle = selectedGame.title || 'Okey Score History';

    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          title: shareTitle,
          text: `Completed game replay: ${shareTitle}`,
          url: shareUrl
        });
        setShareFeedback('Shared successfully.');
        return;
      }

      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setShareFeedback('Share link copied to clipboard.');
        return;
      }

      setShareFeedback('Share is unavailable in this browser.');
    } catch {
      setShareFeedback('Share cancelled.');
    }
  }, [selectedGame]);

  const hasMore = Boolean(historyQuery.hasNextPage);
  const listError = historyQuery.isError
    ? toHistoryErrorMessage(historyQuery.error)
    : null;
  const detailError = selectedGameQuery.isError
    ? toHistoryErrorMessage(selectedGameQuery.error)
    : null;

  return (
    <>
      <Head>
        <title>Okey Score • History</title>
      </Head>
      <AuthGate loadingFallback={null}>
        <DashboardLayout
          title="History"
          subtitle="Review completed games, filter sessions, and replay snapshots in readonly mode."
        >
          <div className={styles.stack}>
            <section className={styles.filtersCard}>
              <div>
                <p className={styles.cardEyebrow}>Filters</p>
                <h3 className={styles.cardTitle}>Completed sessions</h3>
              </div>
              <div className={styles.filterGrid}>
                <label className={styles.field}>
                  From date
                  <input
                    type="date"
                    className={styles.input}
                    value={fromDate}
                    onChange={(event) => setFromDate(event.target.value)}
                  />
                </label>
                <label className={styles.field}>
                  To date
                  <input
                    type="date"
                    className={styles.input}
                    value={toDate}
                    onChange={(event) => setToDate(event.target.value)}
                  />
                </label>
                <label className={styles.field}>
                  Player count
                  <select
                    className={styles.input}
                    value={playerCountFilter}
                    onChange={(event) =>
                      setPlayerCountFilter(event.target.value as PlayerCountFilter)
                    }
                  >
                    <option value="all">All</option>
                    <option value="2">2 players</option>
                    <option value="3">3 players</option>
                    <option value="4">4 players</option>
                  </select>
                </label>
              </div>
              <p className={styles.metaCopy}>
                Showing {filteredItems.length} of {allLoadedItems.length} loaded
                completed games.
              </p>
            </section>

            {listError ? (
              <p className={styles.errorBanner}>{listError}</p>
            ) : null}

            {historyQuery.isLoading ? (
              <article className={styles.stateCard}>
                <p className={styles.cardEyebrow}>Loading</p>
                <h3 className={styles.cardTitle}>Fetching game history</h3>
                <p className={styles.cardCopy}>
                  Restoring completed sessions from your account.
                </p>
              </article>
            ) : null}

            {!historyQuery.isLoading &&
            !historyQuery.isError &&
            allLoadedItems.length === 0 ? (
              <article className={styles.stateCard}>
                <p className={styles.cardEyebrow}>No data</p>
                <h3 className={styles.cardTitle}>No completed games yet</h3>
                <p className={styles.cardCopy}>
                  Completed games will appear here after you finish active sessions.
                </p>
              </article>
            ) : null}

            {!historyQuery.isLoading &&
            !historyQuery.isError &&
            allLoadedItems.length > 0 &&
            filteredItems.length === 0 ? (
              <article className={styles.stateCard}>
                <p className={styles.cardEyebrow}>No matches</p>
                <h3 className={styles.cardTitle}>No games fit current filters</h3>
                <p className={styles.cardCopy}>
                  Adjust date range or player count to broaden results.
                </p>
              </article>
            ) : null}

            {filteredItems.length > 0 ? (
              <section className={styles.list} aria-label="Completed game history">
                {filteredItems.map((item) => {
                  const leaderName =
                    item.snapshot?.leader?.displayName ??
                    item.snapshot?.leader?.name ??
                    'N/A';
                  const playerNames = [...item.players]
                    .sort((left, right) => left.seatIndex - right.seatIndex)
                    .map((player) => player.displayName)
                    .join(' • ');

                  return (
                    <article key={item.id} className={styles.gameCard}>
                      <div className={styles.gameHeader}>
                        <div>
                          <p className={styles.cardEyebrow}>Completed</p>
                          <h4 className={styles.gameTitle}>
                            {item.title || 'Untitled Game'}
                          </h4>
                        </div>
                        <button
                          type="button"
                          className={styles.primaryButton}
                          onClick={() => setSelectedGameId(item.id)}
                        >
                          View replay
                        </button>
                      </div>
                      <p className={styles.cardCopy}>
                        {playerNames || 'No players'}
                      </p>
                      <div className={styles.metaRow}>
                        <span>
                          Completed: {formatDateLabel(item.completedAt)}
                        </span>
                        <span>Leader: {leaderName}</span>
                      </div>
                    </article>
                  );
                })}
              </section>
            ) : null}

            {hasMore ? (
              <div className={styles.paginationRow}>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={() => historyQuery.fetchNextPage()}
                  disabled={historyQuery.isFetchingNextPage}
                >
                  {historyQuery.isFetchingNextPage
                    ? 'Loading more...'
                    : 'Load more'}
                </button>
              </div>
            ) : null}
          </div>

          {selectedGameId ? (
            <div
              className={styles.modalBackdrop}
              role="presentation"
              onClick={(event) => {
                if (event.target === event.currentTarget) {
                  closeModal();
                }
              }}
            >
              <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="history-game-modal-title"
                className={styles.modalCard}
              >
                <header className={styles.modalHeader}>
                  <div>
                    <p className={styles.cardEyebrow}>Replay</p>
                    <h3 id="history-game-modal-title" className={styles.modalTitle}>
                      {selectedGame?.title || 'Game details'}
                    </h3>
                  </div>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={closeModal}
                  >
                    Close
                  </button>
                </header>

                {detailError ? (
                  <p className={styles.errorBanner}>{detailError}</p>
                ) : null}

                {selectedGameQuery.isLoading ? (
                  <p className={styles.metaCopy}>Loading selected game...</p>
                ) : null}

                {selectedGame ? (
                  <>
                    <div className={styles.modalMetaGrid}>
                      <p className={styles.metaChip}>
                        Completed: {formatDateLabel(selectedGame.completedAt)}
                      </p>
                      <p className={styles.metaChip}>
                        Rounds: {selectedGame.rounds.length}
                      </p>
                      <p className={styles.metaChip}>
                        Players: {selectedGame.players.length}
                      </p>
                      <p className={styles.metaChip}>
                        Leader: {selectedGame.leader?.displayName ?? 'N/A'}
                      </p>
                    </div>

                    <div className={styles.modalActions}>
                      <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={handleShare}
                      >
                        Share
                      </button>
                      <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={handleExportJson}
                      >
                        Export JSON
                      </button>
                      <button
                        type="button"
                        className={styles.primaryButton}
                        onClick={handleExportCsv}
                      >
                        Export CSV
                      </button>
                    </div>

                    {shareFeedback ? (
                      <p className={styles.metaCopy}>{shareFeedback}</p>
                    ) : null}

                    <div className={styles.boardShell}>
                      <ScoreBoard
                        key={`history-${selectedGame.id}-${selectedGame.rounds.length}`}
                        title={selectedGame.title || 'Historical replay'}
                        minPlayers={selectedGame.players.length}
                        maxPlayers={selectedGame.players.length}
                        initialPlayers={selectedSeatOrderedPlayers.map(
                          (player) => player.displayName
                        )}
                        initialRounds={selectedInitialRounds}
                        initialPenalties={selectedInitialPenalties}
                        interactionMode="readonly"
                      />
                    </div>
                  </>
                ) : null}
              </section>
            </div>
          ) : null}
        </DashboardLayout>
      </AuthGate>
    </>
  );
}
