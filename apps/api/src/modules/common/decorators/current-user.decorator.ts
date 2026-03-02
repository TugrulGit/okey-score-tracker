import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface RequestUser {
  sub: string;
  email: string;
}

export const CurrentUser = createParamDecorator((data: unknown, ctx: ExecutionContext): RequestUser => {
  const request = ctx.switchToHttp().getRequest<{ user?: RequestUser }>();
  if (!request.user) {
    throw new Error('Request user is not set on context. Ensure JwtAuthGuard is applied.');
  }
  return request.user;
});
