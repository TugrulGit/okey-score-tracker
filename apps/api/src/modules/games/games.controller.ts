import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { GamesService } from './games.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator.js';
import { CreateGameDto } from './dto/create-game.dto.js';
import { AddRoundDto } from './dto/add-round.dto.js';
import { UpdatePlayersDto } from './dto/update-players.dto.js';
import { HistoryQueryDto } from './dto/history-query.dto.js';

@Controller('games')
@UseGuards(JwtAuthGuard)
export class GamesController {
  constructor(private readonly gamesService: GamesService) {}

  @Post()
  createGame(@CurrentUser() user: RequestUser, @Body() dto: CreateGameDto) {
    return this.gamesService.createGame(user.sub, dto);
  }

  @Get('active')
  getActive(@CurrentUser() user: RequestUser) {
    return this.gamesService.getActiveGame(user.sub);
  }

  @Post(':id/rounds')
  addRound(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: AddRoundDto) {
    return this.gamesService.addRound(user.sub, id, dto);
  }

  @Patch(':id/players')
  updatePlayers(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() dto: UpdatePlayersDto) {
    return this.gamesService.updatePlayers(user.sub, id, dto);
  }

  @Post(':id/complete')
  complete(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.gamesService.completeGame(user.sub, id);
  }

  @Get('history')
  getHistory(@CurrentUser() user: RequestUser, @Query() query: HistoryQueryDto) {
    return this.gamesService.getHistory(user.sub, query);
  }

  @Get(':id')
  getGame(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.gamesService.getGameById(user.sub, id);
  }
}
