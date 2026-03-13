import { requestJson } from './httpClient';
import type {
  ActiveGameResponse,
  AddRoundInput,
  CreateGameInput,
  GameDetail,
  UpdatePlayersInput
} from '../../types/games';

// === Games API helpers ===

/**
 * @description Fetches the user's latest active game from the authenticated games proxy.
 * @returns Active game payload when found, otherwise `null`.
 * @Used_by
 *   - Dashboard page query (`useQuery(['active-game'])`).
 * @Side_effects
 *   - Performs network I/O to `/api/games/active`.
 */
export async function fetchActiveGame(): Promise<ActiveGameResponse> {
  return requestJson<ActiveGameResponse>({
    url: '/games/active',
    method: 'GET'
  });
}

/**
 * @description Creates a new game with the provided title/participants.
 * @param payload - Game creation payload containing optional title/notes and ordered players.
 * @returns Newly created game detail projection.
 * @Used_by
 *   - Dashboard quick-action "Start new game" modal.
 * @Side_effects
 *   - Performs network I/O to `POST /api/games`.
 */
export async function createGame(payload: CreateGameInput): Promise<GameDetail> {
  return requestJson<GameDetail>({
    url: '/games',
    method: 'POST',
    data: payload
  });
}

/**
 * @description Appends a round (scores + optional penalties) to an existing game.
 * @param gameId - Target game id.
 * @param payload - Round payload expected by the backend contract.
 * @returns Updated game detail projection after persistence.
 * @Used_by
 *   - Dashboard scoreboard `onRoundSubmit` mutation.
 * @Side_effects
 *   - Performs network I/O to `POST /api/games/:id/rounds`.
 */
export async function addGameRound(
  gameId: string,
  payload: AddRoundInput
): Promise<GameDetail> {
  return requestJson<GameDetail>({
    url: `/games/${gameId}/rounds`,
    method: 'POST',
    data: payload
  });
}

/**
 * @description Persists player rename/reorder edits for a game.
 * @param gameId - Target game id.
 * @param payload - Player update payload with id-linked display names and seat indices.
 * @returns Updated game detail projection after persistence.
 * @Used_by
 *   - Dashboard debounced player autosave flow.
 * @Side_effects
 *   - Performs network I/O to `PATCH /api/games/:id/players`.
 */
export async function updateGamePlayers(
  gameId: string,
  payload: UpdatePlayersInput
): Promise<GameDetail> {
  return requestJson<GameDetail>({
    url: `/games/${gameId}/players`,
    method: 'PATCH',
    data: payload
  });
}

/**
 * @description Marks an active game as completed.
 * @param gameId - Target game id.
 * @returns Updated game detail projection with completed status metadata.
 * @Used_by
 *   - Dashboard quick-action "Mark complete" button.
 * @Side_effects
 *   - Performs network I/O to `POST /api/games/:id/complete`.
 */
export async function completeGame(gameId: string): Promise<GameDetail> {
  return requestJson<GameDetail>({
    url: `/games/${gameId}/complete`,
    method: 'POST'
  });
}
