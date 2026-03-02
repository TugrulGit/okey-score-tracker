import { Module } from '@nestjs/common';
import { PrismaModule } from './modules/prisma/prisma.module.js';
import { GameModule } from './modules/game/game.module.js';
import { AuthModule } from './modules/auth/auth.module.js';

@Module({
  imports: [PrismaModule, AuthModule, GameModule]
})
export class AppModule {}
