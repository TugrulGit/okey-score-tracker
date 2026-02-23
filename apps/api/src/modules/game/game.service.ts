import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

type DbClockRow = { now: Date };

/**
 * GameService currently exposes a basic health snapshot so the API
 * surface can confirm Postgres connectivity before gameplay features land.
 */
@Injectable()
export class GameService {
  private readonly logger = new Logger(GameService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Pings Postgres and returns metadata used by the root liveness route.
   * Throws a 503 if Prisma fails so clients understand the DB dependency.
   */
  async getHealthSnapshot() {
    try {
      const [{ now }] = await this.prisma.$queryRaw<DbClockRow[]>`SELECT NOW() as now`;
      const gameCount = await this.prisma.game.count();
      return {
        database: {
          status: 'ok' as const,
          time: now,
          gameCount
        }
      };
    } catch (error) {
      this.logger.error('Database health check failed', error);
      throw new ServiceUnavailableException('Database unreachable');
    }
  }
}
