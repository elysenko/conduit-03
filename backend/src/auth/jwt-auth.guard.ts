import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** 401 when the Authorization header is missing, malformed, or expired. */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
