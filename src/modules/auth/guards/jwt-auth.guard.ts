import { ForbiddenException, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { ALLOW_PASSWORD_CHANGE_KEY } from '../decorators/allow-password-change.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) { super(); }

  handleRequest(error: unknown, user: any, info: unknown, context: any) {
    const authenticated = super.handleRequest(error, user, info, context);
    const allowed = this.reflector.getAllAndOverride<boolean>(ALLOW_PASSWORD_CHANGE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (authenticated.mustChangePassword && !allowed) {
      throw new ForbiddenException('Debés cambiar tu contraseña antes de continuar.');
    }
    return authenticated;
  }
}
