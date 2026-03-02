import { Module } from '@nestjs/common';
import { PrismaModule } from './modules/prisma/prisma.module.js';
import { GameModule } from './modules/game/game.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { UserModule } from './modules/user/user.module.js';
import { GamesModule } from './modules/games/games.module.js';

@Module({
  imports: [PrismaModule, AuthModule, UserModule, GamesModule, GameModule]
})
export class AppModule {}
