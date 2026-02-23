import { Module } from '@nestjs/common';
import { GameController } from './game.controller.js';
import { GameService } from './game.service.js';

/**
 * GameModule hosts the placeholder health endpoint until gameplay APIs land.
 */
@Module({
  controllers: [GameController],
  providers: [GameService]
})
export class GameModule {}
