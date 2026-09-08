import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Liveness: the process is up. Never touches the database. */
  @Get()
  check(): { status: string } {
    return { status: 'ok' };
  }

  /** Readiness: the database answers. 503 when it does not. */
  @Get('deep')
  async deep(): Promise<{ status: string; database: string }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'up' };
    } catch (error) {
      this.logger.error(
        `Deep health check failed: ${(error as Error).message}`,
      );
      throw new HttpException(
        { status: 'error', database: 'down' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
