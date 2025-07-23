// filepath: apps/api/src/app.controller.ts
import { Controller, Get } from '@nestjs/common';

@Controller()
export class GameController {
  @Get()
  root() {
    return { message: 'Okey Score Tracker API is up ✅' };
  }
}