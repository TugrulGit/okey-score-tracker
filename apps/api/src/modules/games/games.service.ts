import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { GameStatus, PenaltyType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateGameDto } from './dto/create-game.dto.js';
import { AddRoundDto } from './dto/add-round.dto.js';
import { UpdatePlayersDto } from './dto/update-players.dto.js';
import { HistoryQueryDto } from './dto/history-query.dto.js';

// === Prisma Relation Projections ===
// Centralized include definitions keep all read paths aligned and strongly typed.
// Unique construct: `Prisma.validator` + `Prisma.GameGetPayload` keep include trees and inferred payload types in sync.
const gameWithRelations = Prisma.validator<Prisma.GameArgs>()({
  include: {
    players: true,
    rounds: {
      include: {
        scores: true,
        penalties: true
      }
    },
    penalties: true,
    snapshot: true
  }
});

type GameWithRelations = Prisma.GameGetPayload<typeof gameWithRelations>;

const historyWithSnapshot = Prisma.validator<Prisma.GameArgs>()({
  include: {
    players: true,
    snapshot: true
  }
});

type HistoryProjection = Prisma.GameGetPayload<typeof historyWithSnapshot>;

/**
 * Orchestrates game lifecycle, scoring, and snapshot persistence for Okey matches.
 * Consumed by `GamesController` route handlers under `/games`.
 */
@Injectable()
export class GamesService {
  constructor(private readonly prisma: PrismaService) {}

  // === Game Lifecycle Commands ===

  /**
   * Creates a new game and persists initial players in seat order.
   * Consumed by `GamesController.createGame` (`POST /games`).
   * Side effects: writes `game` and `gamePlayer` records, then upserts the snapshot via `refreshSnapshot`.
   */
  async createGame(ownerId: string, dto: CreateGameDto) {
    const seatOrderedPlayers = dto.players.map((player, index) => ({
      displayName: player.displayName,
      userId: player.userId ?? null,
      avatarColor: player.avatarColor,
      seatIndex: index
    }));

    const game = await this.prisma.game.create({
      data: {
        ownerId,
        title: dto.title ?? 'Untitled Game',
        notes: dto.notes,
        players: {
          create: seatOrderedPlayers
        }
      },
      include: gameWithRelations.include
    });

    await this.refreshSnapshot(game.id);
    return this.buildGameResponse(game, ownerId);
  }

  /**
   * Returns the newest active game owned by `userId`, or `null` when none exists.
   * Consumed by `GamesController.getActive` (`GET /games/active`).
   * Side effects: none (read-only query).
   */
  async getActiveGame(userId: string) {
    const game = await this.prisma.game.findFirst({
      where: {
        ownerId: userId,
        status: GameStatus.ACTIVE
      },
      orderBy: { createdAt: 'desc' },
      include: gameWithRelations.include
    });

    if (!game) {
      return null;
    }

    return this.buildGameResponse(game, userId);
  }

  /**
   * Appends a round with scores and optional penalties to an owned game.
   * Consumed by `GamesController.addRound` (`POST /games/:id/rounds`).
   * Side effects: inserts `round`, `roundScore`, and optional penalty rows, then refreshes snapshot state.
   */
  async addRound(userId: string, gameId: string, dto: AddRoundDto) {
    const game = await this.requireOwnerGame(userId, gameId);
    const nextIndex = game.rounds.length ? Math.max(...game.rounds.map((r) => r.index)) + 1 : 0;

    await this.prisma.round.create({
      data: {
        gameId,
        index: nextIndex,
        scores: {
          create: dto.scores.map((score) => ({
            playerId: score.playerId,
            points: score.points
          }))
        },
        penalties: dto.penalties?.length
          ? {
              create: dto.penalties.map((penalty) => ({
                playerId: penalty.playerId,
                type: penalty.type,
                value: penalty.value,
                gameId
              }))
            }
          : undefined
      }
    });

    await this.refreshSnapshot(gameId);
    return this.getGameById(userId, gameId);
  }

  /**
   * Updates player display names and seat order for an owned game.
   * Consumed by `GamesController.updatePlayers` (`PATCH /games/:id/players`).
   * Side effects: updates `gamePlayer` rows and recomputes snapshot totals/leader.
   */
  async updatePlayers(userId: string, gameId: string, dto: UpdatePlayersDto) {
    await this.requireOwnerGame(userId, gameId);

    await Promise.all(
      dto.players.map((player) =>
        this.prisma.gamePlayer.update({
          where: { id: player.id },
          data: {
            displayName: player.displayName,
            seatIndex: player.seatIndex
          }
        })
      )
    );

    await this.refreshSnapshot(gameId);
    return this.getGameById(userId, gameId);
  }

  /**
   * Marks an owned game as completed and timestamps completion.
   * Consumed by `GamesController.complete` (`POST /games/:id/complete`).
   * Side effects: updates status fields and persists a fresh snapshot summary.
   */
  async completeGame(userId: string, gameId: string) {
    await this.requireOwnerGame(userId, gameId);
    await this.prisma.game.update({
      where: { id: gameId },
      data: { status: GameStatus.COMPLETED, completedAt: new Date() }
    });
    await this.refreshSnapshot(gameId);
    return this.getGameById(userId, gameId);
  }

  // === Read Models and History Queries ===

  /**
   * Returns paginated game history visible to the caller with optional filters.
   * Consumed by `GamesController.getHistory` (`GET /games/history`).
   * Side effects: none (read-only); derives cursor pagination metadata from `createdAt`.
   */
  async getHistory(userId: string, query: HistoryQueryDto) {
    const limit = Math.min(query.limit ?? 10, 50);
    const games = await this.prisma.game.findMany({
      where: {
        AND: [
          query.status ? { status: query.status } : {},
          query.participantId
            ? {
                players: {
                  some: {
                    OR: [{ id: query.participantId }, { userId: query.participantId }]
                  }
                }
              }
            : {},
          {
            OR: [
              { ownerId: userId },
              {
                players: {
                  some: { userId }
                }
              }
            ]
          },
          query.cursor ? { createdAt: { lt: new Date(query.cursor) } } : {}
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      include: historyWithSnapshot.include
    });

    const hasMore = games.length > limit;
    const visible = hasMore ? games.slice(0, limit) : games;

    return {
      items: visible.map((game) => this.buildHistoryEntry(game)),
      nextCursor: hasMore ? visible[visible.length - 1]?.createdAt.toISOString() ?? null : null
    };
  }

  /**
   * Loads a single game by id and enforces owner-or-participant access rules.
   * Consumed by `GamesController.getGame` (`GET /games/:id`) and command handlers returning updated state.
   * Side effects: none (read-only); throws `NotFoundException`/`ForbiddenException` for invalid access.
   */
  async getGameById(userId: string, gameId: string) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: gameWithRelations.include
    });
    if (!game) {
      throw new NotFoundException('Game not found');
    }
    const canView =
      game.ownerId === userId ||
      game.players.some((player) => player.userId === userId);
    if (!canView) {
      throw new ForbiddenException('You do not have access to this game');
    }

    return this.buildGameResponse(game, userId);
  }

  // === Internal Authorization and Projection Helpers ===

  /**
   * Internal-only ownership guard used by mutating operations.
   * Called by `addRound`, `updatePlayers`, and `completeGame` before writes.
   * Side effects: none (read-only); throws `NotFoundException` to avoid leaking unauthorized game existence.
   */
  private async requireOwnerGame(userId: string, gameId: string) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: { rounds: true, players: true }
    });
    if (!game || game.ownerId !== userId) {
      throw new NotFoundException('Game not found');
    }
    return game;
  }

  /**
   * Internal-only mapper from relational game data to API response shape.
   * Used by `createGame`, `getActiveGame`, `getGameById`, and `refreshSnapshot`.
   * Side effects: none; derives sorted players/rounds, per-player totals, penalties, and current leader.
   */
  private buildGameResponse(game: GameWithRelations, userId: string) {
    const players = [...game.players].sort((a, b) => a.seatIndex - b.seatIndex);
    const rounds = [...game.rounds].sort((a, b) => a.index - b.index);
    const penaltyTotals = this.computePenaltyTotals(game);
    const roundTotals = this.computeRoundTotals(rounds);
    const totals = players.reduce<Record<string, number>>((acc, player) => {
      const roundTotal = roundTotals[player.id] ?? 0;
      const penaltyTotal = Object.values(penaltyTotals[player.id] ?? {}).reduce((sum, value) => sum + value, 0);
      acc[player.id] = roundTotal - penaltyTotal;
      return acc;
    }, {});

    const leader = players.reduce(
      (best, player) => {
        const total = totals[player.id] ?? 0;
        if (!best || total > best.total) {
          return { playerId: player.id, displayName: player.displayName, total };
        }
        return best;
      },
      undefined as { playerId: string; displayName: string; total: number } | undefined
    );

    return {
      id: game.id,
      ownerId: game.ownerId,
      title: game.title,
      status: game.status,
      notes: game.notes,
      startedAt: game.startedAt,
      completedAt: game.completedAt,
      players: players.map((player) => ({
        id: player.id,
        displayName: player.displayName,
        userId: player.userId,
        seatIndex: player.seatIndex,
        avatarColor: player.avatarColor
      })),
      rounds: rounds.map((round) => ({
        id: round.id,
        index: round.index,
        scores: round.scores.map((score) => ({
          playerId: score.playerId,
          points: score.points
        })),
        penalties: round.penalties.map((penalty) => ({
          id: penalty.id,
          playerId: penalty.playerId,
          type: penalty.type,
          value: penalty.value
        }))
      })),
      penalties: penaltyTotals,
      totals,
      leader,
      isOwner: game.ownerId === userId
    };
  }

  /**
   * Internal-only history projection mapper for lightweight list responses.
   * Used by `getHistory` to avoid returning full round-by-round payloads.
   * Side effects: none.
   */
  private buildHistoryEntry(game: HistoryProjection) {
    const snapshot = game.snapshot?.summary ?? null;
    return {
      id: game.id,
      title: game.title,
      status: game.status,
      completedAt: game.completedAt,
      createdAt: game.createdAt,
      players: game.players.map((player) => ({
        id: player.id,
        displayName: player.displayName,
        seatIndex: player.seatIndex
      })),
      snapshot
    };
  }

  /**
   * Internal-only penalty aggregator keyed by player and `PenaltyType`.
   * Used by `buildGameResponse` to compute net totals and expose grouped penalties.
   * Side effects: none.
   */
  private computePenaltyTotals(game: GameWithRelations) {
    const base = game.players.reduce<Record<string, Record<PenaltyType, number>>>((acc, player) => {
      acc[player.id] = {
        MISPLAY: 0,
        OKEY_TO_OPPONENT: 0,
        USEFUL_TILE: 0,
        FINISHER: 0
      };
      return acc;
    }, {} as Record<string, Record<PenaltyType, number>>);

    for (const penalty of game.penalties) {
      if (!base[penalty.playerId]) {
        base[penalty.playerId] = {
          MISPLAY: 0,
          OKEY_TO_OPPONENT: 0,
          USEFUL_TILE: 0,
          FINISHER: 0
        };
      }
      base[penalty.playerId][penalty.type] += penalty.value;
    }

    return base;
  }

  // === Snapshot Persistence ===

  /**
   * Internal-only snapshot refresher that stores full payload and compact summary.
   * Triggered after all state-changing commands (`createGame`, `addRound`, `updatePlayers`, `completeGame`).
   * Side effects: reads full game graph and performs `gameSnapshot.upsert`.
   */
  private async refreshSnapshot(gameId: string) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: gameWithRelations.include
    });
    if (!game) return;

    const response = this.buildGameResponse(game, game.ownerId);
    const payload = this.toJsonObject(response);
    const summary = this.toJsonObject({
      leader: response.leader ?? null,
      totals: response.totals
    });
    await this.prisma.gameSnapshot.upsert({
      where: { gameId },
      update: { payload, summary },
      create: { gameId, payload, summary }
    });
  }

  /**
   * Internal-only score reducer that sums round scores per player id.
   * Used by `buildGameResponse` before penalty subtraction.
   * Side effects: none.
   */
  private computeRoundTotals(
    rounds: { index: number; scores: { playerId: string; points: number }[] }[]
  ): Record<string, number> {
    return rounds.reduce<Record<string, number>>((totals, round) => {
      round.scores.forEach((score) => {
        totals[score.playerId] = (totals[score.playerId] ?? 0) + score.points;
      });
      return totals;
    }, {});
  }

  /**
   * Internal-only serializer for Prisma JSON columns.
   * Used by `refreshSnapshot` to coerce typed response objects into `Prisma.JsonObject`.
   * Unique construct: generic `<T extends object>` preserves type intent at call sites while normalizing runtime shape.
   * Side effects: performs JSON serialization/deserialization, which strips `undefined` and non-JSON values.
   */
  private toJsonObject<T extends object>(value: T): Prisma.JsonObject {
    return JSON.parse(JSON.stringify(value)) as Prisma.JsonObject;
  }
}
