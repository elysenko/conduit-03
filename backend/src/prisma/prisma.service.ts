import {
  INestApplication,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Close the Nest app when the process is about to exit.
   *
   * Prisma 5+ removed the `beforeExit` client event for the library engine
   * (`this.$on('beforeExit')` throws), so this listens on `process` instead.
   */
  enableShutdownHooks(app: INestApplication): void {
    process.on('beforeExit', () => {
      void app.close().catch((error: unknown) => {
        this.logger.error(`Shutdown failed: ${String(error)}`);
      });
    });
  }
}
