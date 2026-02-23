// filepath: apps/api/src/app.controller.ts
import { Controller, Get } from '@nestjs/common';
import { GameService } from './game.service.js';

/**
 * Temporary landing controller so ops can verify API + DB health quickly.
 */
@Controller()
export class GameController {
  constructor(private readonly gameService: GameService) {}

  /**
   * Returns API banner plus database metadata for smoke testing docker wiring.
   */
  @Get()
  async root() {
    const health = await this.gameService.getHealthSnapshot();
    return {
      message: 'Okey Score Tracker API is up ✅',
      ...health
    };
  }
}
