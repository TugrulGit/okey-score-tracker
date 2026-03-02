import { Module } from '@nestjs/common';
import { GamesController } from './games.controller.js';
import { GamesService } from './games.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [GamesController],
  providers: [GamesService]
})
export class GamesModule {}
