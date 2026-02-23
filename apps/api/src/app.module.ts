import { Module } from '@nestjs/common';
import { PrismaModule } from './modules/prisma/prisma.module.js';
import { GameModule } from './modules/game/game.module.js';

@Module({
  imports: [PrismaModule, GameModule]
})
export class AppModule {}
