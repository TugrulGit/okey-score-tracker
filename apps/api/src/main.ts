import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();            // allow web front-end during dev
  await app.listen(4000);
  console.log(`🚀 API ready at http://localhost:4000`);
}
bootstrap();