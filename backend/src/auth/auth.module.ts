import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';
import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { JWT_ALGORITHM, JWT_EXPIRES_IN, jwtSecret } from './auth.constants';

/**
 * Global so every feature module can `@UseGuards(JwtAuthGuard)` /
 * `OptionalJwtAuthGuard` without re-importing the passport plumbing.
 */
@Global()
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt', session: false }),
    JwtModule.register({
      secret: jwtSecret(),
      signOptions: { algorithm: JWT_ALGORITHM, expiresIn: JWT_EXPIRES_IN },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
    RolesGuard,
  ],
  exports: [AuthService, JwtAuthGuard, OptionalJwtAuthGuard, RolesGuard, JwtModule],
})
export class AuthModule {}
