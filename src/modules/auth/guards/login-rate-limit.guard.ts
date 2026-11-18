import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { LoginRateLimitService } from '../../../shared/env-validation';

@Injectable()
export class LoginRateLimitGuard implements CanActivate {
  constructor(private readonly rateLimit: LoginRateLimitService) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    this.rateLimit.assertAllowed(request.ip || 'unknown', String(request.body?.cuil || '').replace(/\D/g, ''));
    return true;
  }
}
