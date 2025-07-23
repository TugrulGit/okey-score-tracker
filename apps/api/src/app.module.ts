import { Module } from '@nestjs/common';
import { GameController } from './modules/game/game.controller.js';

@Module({
  imports: [],
  controllers: [GameController],
  providers: []
})
export class AppModule {}