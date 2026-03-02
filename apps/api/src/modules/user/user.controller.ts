import { Body, Controller, Delete, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { UserService } from './user.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser, RequestUser } from '../common/decorators/current-user.decorator.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { UpdatePasswordDto } from './dto/update-password.dto.js';

@Controller('users/me')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  getMe(@CurrentUser() user: RequestUser) {
    return this.userService.getMe(user.sub);
  }

  @Patch()
  updateProfile(@CurrentUser() user: RequestUser, @Body() dto: UpdateProfileDto) {
    return this.userService.updateProfile(user.sub, dto);
  }

  @Patch('password')
  changePassword(@CurrentUser() user: RequestUser, @Body() dto: UpdatePasswordDto) {
    return this.userService.changePassword(user.sub, dto);
  }

  @Get('sessions')
  getSessions(@CurrentUser() user: RequestUser) {
    return this.userService.getSessions(user.sub);
  }

  @Delete('sessions/:id')
  deleteSession(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.userService.deleteSession(user.sub, id);
  }
}
