import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type JwtUser = {
  id: string;
  cuil: string;
  email?: string | null;
  role: 'ADMIN' | 'EMPLOYEE';
  employeeId?: string | null;
};

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): JwtUser => {
  return ctx.switchToHttp().getRequest().user;
});
