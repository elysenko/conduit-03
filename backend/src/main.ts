import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  // Every REST route lives under /api; nginx proxies that prefix to this app.
  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // The browser reaches the API same-origin through nginx; permissive CORS only
  // matters for `ng serve` and direct API clients.
  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Conduit API')
    .setDescription('RealWorld-style articles, comments, favorites and follows')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup(
    'api/docs',
    app,
    SwaggerModule.createDocument(app, swaggerConfig),
  );

  app.get(PrismaService).enableShutdownHooks(app);
  app.enableShutdownHooks();

  // Default matches colossus.yaml (backend.port); PORT overrides it.
  const port = parseInt(process.env.PORT ?? '3001', 10);
  await app.listen(port, '0.0.0.0');
  logger.log(`Conduit API listening on http://0.0.0.0:${port}/api`);
  logger.log(`Swagger docs at http://0.0.0.0:${port}/api/docs`);
}

void bootstrap();
