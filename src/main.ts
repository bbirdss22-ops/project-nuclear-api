import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import * as bodyParser from 'body-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.enableCors();

  // Raw body middleware for LINE webhook signature verification
  // This must be BEFORE the global ValidationPipe to capture raw buffer
  app.use(
    '/api/line/webhook',
    bodyParser.raw({
      type: 'application/json',
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 Project Newclear API running on http://localhost:${port}/api/health`);
}
bootstrap();
